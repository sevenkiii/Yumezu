/**
 * 出生点与出生区域。见 RULES.md §5。
 *
 * Phase 1 只实现"给定中心求区域"；随机选择公平出生中心的部分属于 Phase 2。
 */

import type { PlayerId, SpawnInfo, VertexId } from '../core/GameState';
import { reachableWithin, type Graph } from './Graph';

/** 出生区域 = 出生中心及其全部邻居（图距离 <= 1）。 */
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
