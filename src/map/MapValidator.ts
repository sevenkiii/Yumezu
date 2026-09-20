/**
 * 地图结构校验。见 RULES.md §4.5。
 *
 * 所有阈值都参数化；失败时给出原因码与统计，
 * 让生成器可以累积"哪几项检查最常失败"（RULES.md §4.6）。
 */

import {
  articulationPoints,
  bridges,
  connectedComponents,
  degree,
  diameter,
  distancesFrom,
  edgeKeyOf,
  type Edge,
  type Graph,
  type VertexId,
} from './Graph';

export interface MapStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly minDegree: number;
  readonly maxDegree: number;
  readonly degreeOneCount: number;
  readonly diameter: number;
  readonly bridgeCount: number;
  readonly articulationPointCount: number;
  readonly longestDegreeTwoChain: number;
  readonly connected: boolean;
  /** 边在几何上互相穿越的对数（要求严格平面时应为 0）。 */
  readonly crossingEdgePairs: number;
}

export interface MapValidationParams {
  readonly nodeCount: number;
  readonly edgeCountRange: readonly [number, number];
  readonly diameterRange: readonly [number, number];
  readonly maxDegreeOneNodes: number;
  readonly maxDegree: number;
  readonly maxDegreeTwoChain: number;
  readonly maxArticulationPoints: number;
  /** 是否要求边在几何上不交叉（渲染平面的前提）。 */
  readonly requirePlanar: boolean;
}

export interface ValidationIssue {
  readonly code: string;
  readonly detail: string;
}

export interface MapValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly stats: MapStats;
}

const EPSILON = 1e-12;

export function collectStats(graph: Graph): MapStats {
  const degrees = graph.vertices.map((vertex) => degree(graph, vertex.id));
  return {
    nodeCount: graph.vertices.length,
    edgeCount: graph.edges.length,
    minDegree: degrees.length > 0 ? Math.min(...degrees) : 0,
    maxDegree: degrees.length > 0 ? Math.max(...degrees) : 0,
    degreeOneCount: degrees.filter((value) => value === 1).length,
    diameter: diameter(graph),
    bridgeCount: bridges(graph).length,
    articulationPointCount: articulationPoints(graph).length,
    longestDegreeTwoChain: longestDegreeTwoChain(graph),
    connected: connectedComponents(graph).length === 1,
    crossingEdgePairs: countCrossingEdgePairs(graph),
  };
}

export function validateMapStructure(
  graph: Graph,
  params: MapValidationParams,
): MapValidationResult {
  const stats = collectStats(graph);
  const issues: ValidationIssue[] = [];

  const fail = (code: string, detail: string): void => {
    issues.push({ code, detail });
  };

  if (stats.nodeCount !== params.nodeCount) {
    fail('NODE_COUNT', '节点数 ' + stats.nodeCount + ' != ' + params.nodeCount);
  }
  const [minEdges, maxEdges] = params.edgeCountRange;
  if (stats.edgeCount < minEdges || stats.edgeCount > maxEdges) {
    fail('EDGE_COUNT', '边数 ' + stats.edgeCount + ' 不在 ' + minEdges + ' ~ ' + maxEdges + ' 内');
  }
  if (!stats.connected) fail('NOT_CONNECTED', '图不连通');
  if (stats.degreeOneCount > params.maxDegreeOneNodes) {
    fail('DEGREE_ONE', '度数 1 的节点有 ' + stats.degreeOneCount + ' 个');
  }
  if (stats.maxDegree > params.maxDegree) {
    fail('MAX_DEGREE', '最大度数 ' + stats.maxDegree + ' 超过 ' + params.maxDegree);
  }
  if (stats.longestDegreeTwoChain > params.maxDegreeTwoChain) {
    fail(
      'DEGREE_TWO_CHAIN',
      '最长单线路径 ' + stats.longestDegreeTwoChain + ' 超过 ' + params.maxDegreeTwoChain,
    );
  }
  const [minDiameter, maxDiameter] = params.diameterRange;
  if (stats.diameter < minDiameter || stats.diameter > maxDiameter) {
    fail(
      'DIAMETER',
      '直径 ' + stats.diameter + ' 不在 ' + minDiameter + ' ~ ' + maxDiameter + ' 内',
    );
  }
  if (stats.bridgeCount > 0) fail('BRIDGE', '存在 ' + stats.bridgeCount + ' 条桥（单一超级瓶颈）');
  if (stats.articulationPointCount > params.maxArticulationPoints) {
    fail('ARTICULATION_POINT', '割点有 ' + stats.articulationPointCount + ' 个');
  }
  if (params.requirePlanar && stats.crossingEdgePairs > 0) {
    fail('EDGES_CROSS', '有 ' + stats.crossingEdgePairs + ' 对边在几何上交叉');
  }

  return { ok: issues.length === 0, issues, stats };
}

/**
 * 最长的"单线路径"：内部节点度数都是 2 的连续边数。
 *
 * 计算方式：在"只由度数 2 的节点诱导出的子图"里找连通分量，
 * 每个分量贡献 = 分量内的边数 + 两端是否接出（最多 +2）。
 */
export function longestDegreeTwoChain(graph: Graph): number {
  const degreeTwo = new Set<VertexId>(
    graph.vertices.filter((vertex) => degree(graph, vertex.id) === 2).map((vertex) => vertex.id),
  );
  if (degreeTwo.size === 0) return 0;

  const innerEdges = graph.edges.filter((edge) => degreeTwo.has(edge.a) && degreeTwo.has(edge.b));
  const adjacency = new Map<VertexId, VertexId[]>();
  for (const id of degreeTwo) adjacency.set(id, []);
  for (const edge of innerEdges) {
    (adjacency.get(edge.a) as VertexId[]).push(edge.b);
    (adjacency.get(edge.b) as VertexId[]).push(edge.a);
  }

  const outsideNeighbors = new Map<VertexId, number>();
  for (const edge of graph.edges) {
    if (degreeTwo.has(edge.a) && !degreeTwo.has(edge.b)) {
      outsideNeighbors.set(edge.a, (outsideNeighbors.get(edge.a) ?? 0) + 1);
    }
    if (degreeTwo.has(edge.b) && !degreeTwo.has(edge.a)) {
      outsideNeighbors.set(edge.b, (outsideNeighbors.get(edge.b) ?? 0) + 1);
    }
  }

  const seen = new Set<VertexId>();
  let longest = 0;
  for (const start of degreeTwo) {
    if (seen.has(start)) continue;
    const stack: VertexId[] = [start];
    const component: VertexId[] = [];
    seen.add(start);
    while (stack.length > 0) {
      const current = stack.pop() as VertexId;
      component.push(current);
      for (const next of adjacency.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    const inComponent = new Set(component);
    const innerCount = innerEdges.filter(
      (edge) => inComponent.has(edge.a) && inComponent.has(edge.b),
    ).length;
    let attachments = 0;
    for (const id of component) attachments += outsideNeighbors.get(id) ?? 0;
    const chain = innerCount + Math.min(attachments, 2);
    if (chain > longest) longest = chain;
  }
  return longest;
}

/** 几何上互相穿越的边对数（共享端点的边不计）。 */
export function countCrossingEdgePairs(graph: Graph): number {
  const vertices = new Map<VertexId, { x: number; y: number }>();
  for (const vertex of graph.vertices) vertices.set(vertex.id, { x: vertex.x, y: vertex.y });

  let crossing = 0;
  for (let i = 0; i < graph.edges.length; i += 1) {
    for (let j = i + 1; j < graph.edges.length; j += 1) {
      const first = graph.edges[i] as Edge;
      const second = graph.edges[j] as Edge;
      if (
        first.a === second.a ||
        first.a === second.b ||
        first.b === second.a ||
        first.b === second.b
      ) {
        continue;
      }
      const p1 = vertices.get(first.a) as { x: number; y: number };
      const p2 = vertices.get(first.b) as { x: number; y: number };
      const p3 = vertices.get(second.a) as { x: number; y: number };
      const p4 = vertices.get(second.b) as { x: number; y: number };
      if (segmentsCross(p1, p2, p3, p4)) crossing += 1;
    }
  }
  return crossing;
}

interface XY {
  readonly x: number;
  readonly y: number;
}

function orientation(a: XY, b: XY, c: XY): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (value > EPSILON) return 1;
  if (value < -EPSILON) return -1;
  return 0;
}

/** 规范相交（proper intersection）：端点接触与共线重叠都返回 false。 */
export function segmentsCross(p1: XY, p2: XY, p3: XY, p4: XY): boolean {
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);
  return d1 !== d2 && d3 !== d4;
}

/** 供调试使用：边的键列表。 */
export function edgeKeysOf(graph: Graph): string[] {
  return graph.edges.map((edge) => edgeKeyOf(edge)).sort();
}

/** 图的偏心距（供出生点选择使用）。 */
export function eccentricity(graph: Graph, vertex: VertexId): number {
  let worst = 0;
  for (const value of distancesFrom(graph, vertex).values()) {
    if (value > worst) worst = value;
  }
  return worst;
}
