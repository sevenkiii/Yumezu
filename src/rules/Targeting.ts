/**
 * 目标判定的通用工具：敌我关系、距离、节点占用。
 *
 * 所有函数都是纯函数，只读取 GameState，不修改它。
 */

import type { CardChoice, SkillChoice } from '../core/Action';
import type { CharacterId, CharacterState, GameState, PlayerId, VertexId } from '../core/GameState';
import { distance } from '../map/Graph';

/** 节点 -> 占据该节点的角色 id。阵亡角色不占位。 */
export function occupiedVertices(state: GameState): Map<VertexId, CharacterId> {
  const map = new Map<VertexId, CharacterId>();
  for (const character of state.characters) {
    if (character.alive) map.set(character.position, character.id);
  }
  return map;
}

export function occupantAt(state: GameState, vertex: VertexId): CharacterId | null {
  return occupiedVertices(state).get(vertex) ?? null;
}

export function isOccupied(state: GameState, vertex: VertexId): boolean {
  return occupantAt(state, vertex) !== null;
}

export function aliveCharacters(state: GameState): CharacterState[] {
  return state.characters.filter((character) => character.alive);
}

export function aliveAllies(state: GameState, player: PlayerId): CharacterState[] {
  return state.characters.filter((character) => character.alive && character.owner === player);
}

export function aliveEnemies(state: GameState, player: PlayerId): CharacterState[] {
  return state.characters.filter((character) => character.alive && character.owner !== player);
}

export function isEnemyOf(character: CharacterState, player: PlayerId): boolean {
  return character.alive && character.owner !== player;
}

/** 图距离：忽略封路的最短路，用于攻击 / 技能 / 换位。 */
export function graphDistance(state: GameState, a: VertexId, b: VertexId): number {
  return distance(state.map.graph, a, b);
}

export function characterDistance(state: GameState, a: CharacterState, b: CharacterState): number {
  return graphDistance(state, a.position, b.position);
}
/** 与某点距离不超过 range 的全部存活敌方角色。 */
export function enemiesWithin(
  state: GameState,
  player: PlayerId,
  from: VertexId,
  range: number,
): CharacterState[] {
  return aliveEnemies(state, player).filter(
    (character) => distance(state.map.graph, from, character.position) <= range,
  );
}

/** 与 actor 距离不超过 range 的其他存活角色（含友方与敌方，不含自身）。 */
export function otherCharactersWithin(
  state: GameState,
  actor: CharacterState,
  range: number,
): CharacterState[] {
  return aliveCharacters(state).filter(
    (character) =>
      character.id !== actor.id &&
      distance(state.map.graph, actor.position, character.position) <= range,
  );
}

/** 判断技能参数是否相同。 */
export function skillChoiceEquals(a: SkillChoice, b: SkillChoice): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'SINGLE_TARGET' && b.kind === 'SINGLE_TARGET') return a.targetId === b.targetId;
  if (a.kind === 'MOVE_THEN_STRIKE' && b.kind === 'MOVE_THEN_STRIKE') return a.to === b.to;
  return true;
}

/** 判断功能牌参数是否相同。 */
export function cardChoiceEquals(a: CardChoice, b: CardChoice): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'SINGLE_TARGET':
      return b.kind === 'SINGLE_TARGET' && a.targetId === b.targetId && a.status === b.status;
    case 'MOVE_TO':
      return b.kind === 'MOVE_TO' && a.targetId === b.targetId && a.to === b.to;
    case 'EDGE':
      return b.kind === 'EDGE' && a.edge === b.edge;
    case 'VERTEX':
      return b.kind === 'VERTEX' && a.vertex === b.vertex;
    default:
      return false;
  }
}
