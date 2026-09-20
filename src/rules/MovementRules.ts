/**
 * 移动规则。见 RULES.md §8.1 与 §6。
 *
 * 要点：
 *  - 距离使用「移动距离」，即封锁边视为不可通行。
 *  - 不能穿过敌方角色，可以穿过友方角色。
 *  - 不能停留在任何已被占据的节点（自己的当前位置除外）。
 *  - 允许移动 0 格。
 */

import type { CharacterState, EdgeKey, GameState, VertexId } from '../core/GameState';
import { distancesFrom } from '../map/Graph';
import { occupiedVertices } from './Targeting';

/** 当前被封锁的边集合。 */
export function blockedEdgeSet(state: GameState): Set<EdgeKey> {
  const set = new Set<EdgeKey>();
  for (const blocked of state.map.blockedEdges) set.add(blocked.edge);
  return set;
}

/** 移动时不可穿越的节点：敌方角色所在节点。 */
export function impassableForMovement(state: GameState, mover: CharacterState): Set<VertexId> {
  const set = new Set<VertexId>();
  for (const character of state.characters) {
    if (!character.alive) continue;
    if (character.id === mover.id) continue;
    if (character.owner === mover.owner) continue;
    set.add(character.position);
  }
  return set;
}

/**
 * mover 在移动距离不超过 range 的前提下可以落脚的节点（含当前位置，代表移动 0 格）。
 * range 省略时使用角色自身的 moveRange。
 */
export function reachableDestinations(
  state: GameState,
  mover: CharacterState,
  range?: number,
): VertexId[] {
  const limit = range ?? mover.moveRange;
  const dist = distancesFrom(state.map.graph, mover.position, {
    blockedEdges: blockedEdgeSet(state),
    impassable: impassableForMovement(state, mover),
  });
  const occupied = occupiedVertices(state);
  const out: VertexId[] = [];
  for (const [vertex, d] of dist) {
    if (d > limit) continue;
    if (vertex === mover.position) {
      out.push(vertex);
      continue;
    }
    if (occupied.has(vertex)) continue;
    out.push(vertex);
  }
  return out.sort((a, b) => a - b);
}

export function canMoveTo(state: GameState, mover: CharacterState, to: VertexId): boolean {
  return reachableDestinations(state, mover).includes(to);
}

/** 仅返回真正改变位置的落点（用于「瞬步」这类必须产生效果的牌）。 */
export function reachableDestinationsExcludingSelf(
  state: GameState,
  mover: CharacterState,
  range?: number,
): VertexId[] {
  return reachableDestinations(state, mover, range).filter((vertex) => vertex !== mover.position);
}
