/**
 * 随机平面图生成。见 RULES.md §4.3。
 *
 * 流程：
 *   mapSeed → points 子流采点（单位正方形 + 最小间距）
 *   → 打乱点序（节点 id 由 mapSeed 稳定决定，但不与空间顺序绑定）
 *   → Delaunay 三角剖分（triangulation.ts）
 *   → 对边做随机顺序的 Kruskal，得到一棵随机生成树（保证连通）
 *   → 随机补边到目标边数（保持平面性）
 *   → 修复阶段：消除度数 1 的节点与桥（只加 Delaunay 边，因此仍然平面）
 *   → Validator（MapValidator.ts）
 *   → 合格：再随机选出生中心；不合格：继续下一次尝试
 *
 * 修复阶段是必要的：随机生成树必然带桥与叶子，纯粹随机补边命中"无桥 + 无度数 1"
 * 的概率很低（实测约 45 次尝试才成功一次）。修复只使用 Delaunay 边，
 * 不改变平面性与边数上界，也不放宽任何校验条件。
 *
 * 失败 maxAttempts 次后抛出带原因统计的错误，绝不静默放宽条件（RULES.md §4.6）。
 */

import { createMapRngStreams, createRngCursor, type RngCursor } from '../core/RNG';
import type { PlayerId, SpawnInfo, VertexId } from '../core/GameState';
import {
  bridges,
  degree,
  edgeKeyOf,
  parseEdgeKey,
  type Edge,
  type EdgeKey,
  type Graph,
  type Vertex,
} from './Graph';
import {
  collectStats,
  validateMapStructure,
  type MapStats,
  type MapValidationParams,
} from './MapValidator';
import { computeSpawnInfo, selectSpawnCenters, type SpawnParams } from './SpawnGenerator';
import { delaunayEdges, type Point } from './triangulation';

export interface MapGenerationParams extends MapValidationParams, SpawnParams {
  /** 同一 mapSeed 内部的最大尝试次数。 */
  readonly maxAttempts: number;
  /** 采点时两点的最小距离（避免退化三角形）。 */
  readonly minPointDistance: number;
  /** 每个点最多尝试多少次采点。 */
  readonly pointAttempts: number;
}

export const DEFAULT_MAP_PARAMS: MapGenerationParams = {
  nodeCount: 30,
  edgeCountRange: [40, 50],
  diameterRange: [7, 10],
  maxDegreeOneNodes: 2,
  maxDegree: 6,
  maxDegreeTwoChain: 4,
  maxArticulationPoints: 2,
  requirePlanar: true,
  regionRadius: 1,
  distanceRange: [6, 8],
  minRegionGap: 5,
  minRegionSize: 3,
  maxCenterBalance: 1,
  maxAttempts: 200,
  minPointDistance: 0.09,
  pointAttempts: 200,
};

export interface GeneratedMap {
  readonly graph: Graph;
  readonly spawnCenters: Record<PlayerId, VertexId>;
  readonly spawn: Record<PlayerId, SpawnInfo>;
  readonly stats: MapStats;
  /** 实际用掉了几次尝试（1 表示一次成功）。 */
  readonly attempts: number;
}

export class MapGenerationError extends Error {
  readonly attempts: number;
  /** 失败原因码 → 出现次数。 */
  readonly failures: Readonly<Record<string, number>>;

  constructor(attempts: number, failures: Readonly<Record<string, number>>) {
    super(
      '地图生成失败：' +
        attempts +
        ' 次尝试都没有得到合格地图（' +
        describeFailures(failures) +
        '）',
    );
    this.name = 'MapGenerationError';
    this.attempts = attempts;
    this.failures = failures;
  }
}

export function describeFailures(failures: Readonly<Record<string, number>>): string {
  const entries = Object.entries(failures).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '没有可用诊断信息';
  return entries.map(([code, count]) => code + ' x' + count).join(', ');
}

/** 生成地图与出生点。相同 mapSeed 必然得到完全相同的结果。 */
export function generateMap(
  mapSeed: string,
  overrides: Partial<MapGenerationParams> = {},
): GeneratedMap {
  const params: MapGenerationParams = { ...DEFAULT_MAP_PARAMS, ...overrides };
  const streams = createMapRngStreams(mapSeed);
  const points = createRngCursor(streams.points);
  const edges = createRngCursor(streams.edges);
  const spawn = createRngCursor(streams.spawn);

  const failures: Record<string, number> = {};
  const record = (code: string): void => {
    failures[code] = (failures[code] ?? 0) + 1;
  };

  for (let attempt = 1; attempt <= params.maxAttempts; attempt += 1) {
    const graph = attemptGraph(points, edges, params);
    if (graph === null) {
      record('DEGENERATE_POINTS');
      continue;
    }

    const validation = validateMapStructure(graph, params);
    if (!validation.ok) {
      for (const issue of validation.issues) record(issue.code);
      continue;
    }

    const selection = selectSpawnCenters(graph, spawn, params);
    if (selection === null) {
      record('NO_VALID_SPAWN');
      continue;
    }

    return {
      graph,
      spawnCenters: selection.centers,
      spawn: computeSpawnInfo(graph, selection.centers, params.regionRadius),
      stats: validation.stats,
      attempts: attempt,
    };
  }

  throw new MapGenerationError(params.maxAttempts, failures);
}

/** 一次尝试：采点 → Delaunay → 生成树 → 补边 → 修复。失败返回 null。 */
function attemptGraph(
  points: RngCursor,
  edges: RngCursor,
  params: MapGenerationParams,
): Graph | null {
  const sampled = samplePoints(
    points,
    params.nodeCount,
    params.minPointDistance,
    params.pointAttempts,
  );
  if (sampled === null) return null;

  const shuffledPoints = points.shuffled(sampled);
  const delaunay = delaunayEdges(shuffledPoints);
  if (delaunay.length < params.nodeCount - 1) return null;

  const order = edges.shuffled(delaunay);
  const tree = randomSpanningTree(params.nodeCount, order);
  if (tree.length !== params.nodeCount - 1) return null;

  const [minEdges, maxEdges] = params.edgeCountRange;
  const target = edges.nextInt(Math.max(minEdges, tree.length), maxEdges);

  const chosen: Edge[] = tree.slice();
  const used = new Set<EdgeKey>(chosen.map((edge) => edgeKeyOf(edge)));
  for (const edge of order) {
    if (chosen.length >= target) break;
    const key = edgeKeyOf(edge);
    if (used.has(key)) continue;
    used.add(key);
    chosen.push(edge);
  }

  const vertices: Vertex[] = shuffledPoints.map((point, index) => ({
    id: index,
    x: point.x,
    y: point.y,
  }));

  const repaired = repairStructure(vertices, chosen, used, order, params, edges);
  if (!repaired) return null;

  return { vertices, edges: chosen };
}

/**
 * 修复阶段：反复处理"度数为 1 的节点"与"桥"，只添加尚未使用的 Delaunay 边。
 * 达到边数上限仍无法修复时返回 false（该次尝试失败）。
 */
function repairStructure(
  vertices: readonly Vertex[],
  chosen: Edge[],
  used: Set<EdgeKey>,
  candidates: readonly Edge[],
  params: MapGenerationParams,
  cursor: RngCursor,
): boolean {
  const maxEdges = params.edgeCountRange[1];
  const maxRepairs = params.nodeCount * 3;

  for (let step = 0; step < maxRepairs; step += 1) {
    const graph: Graph = { vertices, edges: chosen };

    const leaves = vertices.filter((vertex) => degree(graph, vertex.id) === 1).map((v) => v.id);
    if (leaves.length > 0) {
      if (chosen.length >= maxEdges) return false;
      const leaf = leaves[cursor.nextIndex(leaves.length)] as VertexId;
      const candidate = pickUnusedIncident(candidates, used, leaf, cursor);
      if (candidate === null) return false;
      used.add(edgeKeyOf(candidate));
      chosen.push(candidate);
      continue;
    }

    const bridgeKeys = bridges(graph);
    if (bridgeKeys.length === 0) return true;
    if (chosen.length >= maxEdges) return false;

    const bridgeKey = bridgeKeys[cursor.nextIndex(bridgeKeys.length)] as EdgeKey;
    const candidate = pickCoveringEdge(graph, candidates, used, bridgeKey, cursor);
    if (candidate === null) return false;
    used.add(edgeKeyOf(candidate));
    chosen.push(candidate);
  }
  return false;
}

/** 在尚未使用的候选边中随机挑一条与 vertex 相连的边。 */
function pickUnusedIncident(
  candidates: readonly Edge[],
  used: ReadonlySet<EdgeKey>,
  vertex: VertexId,
  cursor: RngCursor,
): Edge | null {
  const options = candidates.filter(
    (edge) => (edge.a === vertex || edge.b === vertex) && !used.has(edgeKeyOf(edge)),
  );
  if (options.length === 0) return null;
  return options[cursor.nextIndex(options.length)] as Edge;
}

/** 在尚未使用的候选边中随机挑一条"跨越该桥"的边，从而消除这个瓶颈。 */
function pickCoveringEdge(
  graph: Graph,
  candidates: readonly Edge[],
  used: ReadonlySet<EdgeKey>,
  bridgeKey: EdgeKey,
  cursor: RngCursor,
): Edge | null {
  const { a, b } = parseEdgeKey(bridgeKey);
  const side = collectSide(graph, a, bridgeKey);

  const options = candidates.filter((edge) => {
    if (used.has(edgeKeyOf(edge))) return false;
    const aInside = side.has(edge.a);
    const bInside = side.has(edge.b);
    return aInside !== bInside;
  });
  void b;
  if (options.length === 0) return null;
  return options[cursor.nextIndex(options.length)] as Edge;
}

/** 去掉指定边之后，从 start 出发能到达的节点集合。 */
function collectSide(graph: Graph, start: VertexId, removed: EdgeKey): Set<VertexId> {
  const adjacency = new Map<VertexId, VertexId[]>();
  for (const vertex of graph.vertices) adjacency.set(vertex.id, []);
  for (const edge of graph.edges) {
    if (edgeKeyOf(edge) === removed) continue;
    (adjacency.get(edge.a) as VertexId[]).push(edge.b);
    (adjacency.get(edge.b) as VertexId[]).push(edge.a);
  }

  const seen = new Set<VertexId>([start]);
  const stack: VertexId[] = [start];
  while (stack.length > 0) {
    const current = stack.pop() as VertexId;
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return seen;
}

/**
 * 单位正方形内采点，并保证任意两点距离不小于 minDistance。
 * minDistance 太高导致放不下时按 0.7 倍逐步放宽；过小则判定本次尝试失败。
 */
function samplePoints(
  cursor: RngCursor,
  count: number,
  minDistance: number,
  attemptsPerPoint: number,
): Point[] | null {
  const points: Point[] = [];
  let threshold = minDistance;

  for (let index = 0; index < count; index += 1) {
    let placed = false;
    for (let attempt = 0; attempt < attemptsPerPoint; attempt += 1) {
      const candidate: Point = { x: cursor.nextFloat(), y: cursor.nextFloat() };
      const ok = points.every(
        (other) => squaredDistance(other, candidate) >= threshold * threshold,
      );
      if (!ok) continue;
      points.push(candidate);
      placed = true;
      break;
    }
    if (placed) continue;

    threshold *= 0.7;
    if (threshold < 1e-4) return null;
    index -= 1;
  }
  return points;
}

function squaredDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** 对给定边序做 Kruskal，得到一棵随机生成树（边序来自 seed，因此可复现）。 */
function randomSpanningTree(nodeCount: number, edges: readonly Edge[]): Edge[] {
  const parent = Array.from({ length: nodeCount }, (_, index) => index);

  const find = (start: number): number => {
    let root = start;
    while ((parent[root] as number) !== root) root = parent[root] as number;
    let current = start;
    while ((parent[current] as number) !== root) {
      const next = parent[current] as number;
      parent[current] = root;
      current = next;
    }
    return root;
  };

  const tree: Edge[] = [];
  for (const edge of edges) {
    const rootA = find(edge.a);
    const rootB = find(edge.b);
    if (rootA === rootB) continue;
    parent[rootA] = rootB;
    tree.push(edge);
    if (tree.length === nodeCount - 1) break;
  }
  return tree;
}

/** 便捷入口：只取统计信息（供测试与调参使用）。 */
export function generateMapStats(
  mapSeed: string,
  overrides: Partial<MapGenerationParams> = {},
): MapStats {
  return collectStats(generateMap(mapSeed, overrides).graph);
}

/** 默认参数的一份副本（防止调用方误改共享常量）。 */
export function defaultMapParams(): MapGenerationParams {
  return { ...DEFAULT_MAP_PARAMS };
}
