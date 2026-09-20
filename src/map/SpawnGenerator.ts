/**
 * 出生点与出生区域。见 RULES.md §5。
 *
 * 选点规则（全部参数化）：
 *  - 6 <= 两中心距离 <= 8
 *  - 两出生区域最小距离 >= 5（两个区域自然不相交）
 *  - 两区域各自节点数 >= 3（等价于中心度数 >= 2）
 *  - 两中心到地图中心的距离差 <= 1（不再限制度数差）
 */

import type { RngCursor } from '../core/RNG';
import type { PlayerId, SpawnInfo, VertexId } from '../core/GameState';
import { distance, distancesFrom, reachableWithin, type Graph } from './Graph';

export interface SpawnParams {
  readonly regionRadius: number;
  readonly distanceRange: readonly [number, number];
  readonly minRegionGap: number;
  readonly minRegionSize: number;
  readonly maxCenterBalance: number;
}

export const DEFAULT_SPAWN_PARAMS: SpawnParams = {
  regionRadius: 1,
  distanceRange: [6, 8],
  minRegionGap: 5,
  minRegionSize: 3,
  maxCenterBalance: 1,
};

/** 出生区域 = 出生中心及其全部邻居（图距离 <= radius）。 */
export function computeSpawnInfo(
  graph: Graph,
  centers: Record<PlayerId, VertexId>,
  radius = 1,
): Record<PlayerId, SpawnInfo> {
  return {
    P1: { center: centers.P1, region: reachableWithin(graph, centers.P1, radius) },
    P2: { center: centers.P2, region: reachableWithin(graph, centers.P2, radius) },
  };
}

/**
 * 地图中心：偏心距最小的节点。
 * 并列时取离几何质心最近的，再并列取 id 最小的（保证确定性）。
 */
export function graphCenter(graph: Graph): VertexId {
  const centroidX =
    graph.vertices.reduce((sum, vertex) => sum + vertex.x, 0) / graph.vertices.length;
  const centroidY =
    graph.vertices.reduce((sum, vertex) => sum + vertex.y, 0) / graph.vertices.length;

  let best: { id: VertexId; eccentricity: number; centroidDistance: number } | null = null;
  for (const vertex of graph.vertices) {
    const distances = distancesFrom(graph, vertex.id);
    let eccentricity = 0;
    for (const value of distances.values()) {
      if (value > eccentricity) eccentricity = value;
    }
    const dx = vertex.x - centroidX;
    const dy = vertex.y - centroidY;
    const centroidDistance = Math.sqrt(dx * dx + dy * dy);
    if (
      best === null ||
      eccentricity < best.eccentricity ||
      (eccentricity === best.eccentricity && centroidDistance < best.centroidDistance) ||
      (eccentricity === best.eccentricity &&
        centroidDistance === best.centroidDistance &&
        vertex.id < best.id)
    ) {
      best = { id: vertex.id, eccentricity, centroidDistance };
    }
  }
  if (best === null) throw new Error('graphCenter: 图为空');
  return best.id;
}

export interface SpawnCandidate {
  readonly centers: Record<PlayerId, VertexId>;
  readonly centerDistance: number;
  readonly balance: number;
  readonly regionSizes: Record<PlayerId, number>;
  readonly regionGap: number;
}

/** 枚举所有满足约束的出生中心对（无序对，双方可互换）。 */
export function listSpawnCandidates(
  graph: Graph,
  params: SpawnParams = DEFAULT_SPAWN_PARAMS,
): SpawnCandidate[] {
  const [minDistance, maxDistance] = params.distanceRange;
  const center = graphCenter(graph);
  const centerDistances = distancesFrom(graph, center);

  const allDistances = new Map<VertexId, Map<VertexId, number>>();
  const regions = new Map<VertexId, VertexId[]>();
  for (const vertex of graph.vertices) {
    allDistances.set(vertex.id, distancesFrom(graph, vertex.id));
    regions.set(vertex.id, reachableWithin(graph, vertex.id, params.regionRadius));
  }

  const candidates: SpawnCandidate[] = [];
  for (let i = 0; i < graph.vertices.length; i += 1) {
    const a = graph.vertices[i] as { id: VertexId };
    for (let j = i + 1; j < graph.vertices.length; j += 1) {
      const b = graph.vertices[j] as { id: VertexId };
      const gap = (allDistances.get(a.id) as Map<VertexId, number>).get(b.id);
      if (gap === undefined || gap < minDistance || gap > maxDistance) continue;

      const regionA = regions.get(a.id) as VertexId[];
      const regionB = regions.get(b.id) as VertexId[];
      if (regionA.length < params.minRegionSize || regionB.length < params.minRegionSize) continue;

      const balance = Math.abs((centerDistances.get(a.id) ?? 0) - (centerDistances.get(b.id) ?? 0));
      if (balance > params.maxCenterBalance) continue;

      if (regionMinDistance(regionA, regionB, allDistances) < params.minRegionGap) continue;

      candidates.push({
        centers: { P1: a.id, P2: b.id },
        centerDistance: gap,
        balance,
        regionSizes: { P1: regionA.length, P2: regionB.length },
        regionGap: regionMinDistance(regionA, regionB, allDistances),
      });
    }
  }
  return candidates;
}

/** 两个区域之间的最小图距离。 */
export function regionMinDistance(
  regionA: readonly VertexId[],
  regionB: readonly VertexId[],
  allDistances: ReadonlyMap<VertexId, ReadonlyMap<VertexId, number>>,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const a of regionA) {
    const distances = allDistances.get(a);
    if (distances === undefined) continue;
    for (const b of regionB) {
      const value = distances.get(b);
      if (value !== undefined && value < best) best = value;
    }
  }
  return best;
}

/**
 * 随机选一对出生中心（等概率从全部合格候选中抽取）。
 * 没有合格候选时返回 null，由生成器当作一次失败尝试。
 */
export function selectSpawnCenters(
  graph: Graph,
  cursor: RngCursor,
  params: SpawnParams = DEFAULT_SPAWN_PARAMS,
): { readonly centers: Record<PlayerId, VertexId>; readonly candidateCount: number } | null {
  const candidates = listSpawnCandidates(graph, params);
  if (candidates.length === 0) return null;

  const picked = candidates[cursor.nextIndex(candidates.length)] as SpawnCandidate;
  const swap = cursor.nextIndex(2) === 1;
  const centers: Record<PlayerId, VertexId> = swap
    ? { P1: picked.centers.P2, P2: picked.centers.P1 }
    : { P1: picked.centers.P1, P2: picked.centers.P2 };
  return { centers, candidateCount: candidates.length };
}

/** 便捷查询：两点之间的图距离（用于测试与调试）。 */
export function centerDistance(graph: Graph, centers: Record<PlayerId, VertexId>): number {
  return distance(graph, centers.P1, centers.P2);
}
