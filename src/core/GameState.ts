/**
 * 游戏状态的类型定义。
 *
 * 原则（见 RULES.md §0）：
 *  - GameState 是唯一真相，一切通过 S(t+1) = F(S(t), A(t)) 推进。
 *  - 必须可 JSON 序列化，并包含 RNG 状态。
 *  - 不包含任何 UI / DOM / 网络相关数据。
 */

import type { EdgeKey, Graph, VertexId } from '../map/Graph';
import type { Action } from './Action';
import type { GameEvent } from './Event';
import type { RngStreamName, RngStreamState } from './RNG';

export type { EdgeKey, Graph, VertexId };

export type PlayerId = 'P1' | 'P2';

export const PLAYER_IDS: readonly PlayerId[] = ['P1', 'P2'];

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'P1' ? 'P2' : 'P1';
}

/** 角色实例 id，形如 "P1:Nana"。 */
export type CharacterId = string;

export type CharacterTypeId = 'Nana' | 'Lily' | 'Melty' | 'Mikage' | 'Spica' | 'Urara';

export const CHARACTER_TYPE_IDS: readonly CharacterTypeId[] = [
  'Nana',
  'Lily',
  'Melty',
  'Mikage',
  'Spica',
  'Urara',
];

export type SkillId = 'Globe' | 'Swap' | 'MeltyLand' | 'ShadowReturn' | 'StarDash' | 'Freeze';

export type CardId =
  | 'FirstAid'
  | 'Shield'
  | 'Assault'
  | 'Recharge'
  | 'Purify'
  | 'Blink'
  | 'Repulse'
  | 'BlockRoad'
  | 'Mark'
  | 'SealSkill'
  | 'Trap';

export type StatusType = 'Frozen' | 'SkillSealed' | 'Marked' | 'Shielded' | 'Empowered';

export const STATUS_TYPES: readonly StatusType[] = [
  'Frozen',
  'SkillSealed',
  'Marked',
  'Shielded',
  'Empowered',
];

/** 可被「净化」移除的负面状态。 */
export const NEGATIVE_STATUS_TYPES: readonly StatusType[] = ['Frozen', 'SkillSealed', 'Marked'];

export type StatusSet = Record<StatusType, boolean>;

export function createStatusSet(): StatusSet {
  return { Frozen: false, SkillSealed: false, Marked: false, Shielded: false, Empowered: false };
}

export interface CharacterState {
  readonly id: CharacterId;
  readonly owner: PlayerId;
  readonly typeId: CharacterTypeId;
  /** 所在节点；阵亡后不再有位置意义。 */
  position: VertexId;
  hp: number;
  readonly maxHp: number;
  readonly moveRange: number;
  readonly attackRange: number;
  readonly attackDamage: number;
  readonly skillId: SkillId;
  /** 剩余技能 CD；0 表示可用。 */
  skillCd: number;
  statuses: StatusSet;
  /** 影返标记所在节点；null 表示技能未生效。 */
  shadowMark: VertexId | null;
  alive: boolean;
}

/** 手牌实例：同一张牌可以有多个不同实例。 */
export interface HandCard {
  readonly id: string;
  readonly cardId: CardId;
}

export interface PlayerState {
  readonly id: PlayerId;
  hand: HandCard[];
  /** 手牌实例 id 的自增序号。 */
  nextCardSeq: number;
}

export interface SpawnInfo {
  readonly center: VertexId;
  /** d(v, center) <= 1 的全部节点，含中心自身。 */
  readonly region: readonly VertexId[];
}

export interface BlockedEdge {
  readonly edge: EdgeKey;
  readonly owner: PlayerId;
  /** 当 turnIndex 达到该值时，封锁自动解除。 */
  readonly expiresAtTurnIndex: number;
}

export interface Trap {
  readonly id: string;
  readonly owner: PlayerId;
  readonly vertex: VertexId;
}

export interface MapState {
  readonly graph: Graph;
  blockedEdges: BlockedEdge[];
  traps: Trap[];
  nextTrapSeq: number;
}

export interface DeploymentAssignment {
  readonly characterId: CharacterId;
  readonly vertex: VertexId;
}

export interface Deployment {
  readonly assignments: readonly DeploymentAssignment[];
}

export type GamePhase = 'DEPLOY' | 'BATTLE' | 'FINISHED';

export type EndReason = 'ANNIHILATION' | 'MUTUAL_ANNIHILATION' | 'TURN_LIMIT';

export type GameResult =
  | { readonly kind: 'WIN'; readonly winner: PlayerId; readonly reason: EndReason }
  | { readonly kind: 'DRAW'; readonly reason: EndReason };

export interface GameConfig {
  /** 可选回合上限；null 表示不设上限（V1 默认）。 */
  readonly maxTurns: number | null;
}

export interface ActionRecord {
  readonly action: Action;
  readonly events: readonly GameEvent[];
}

export interface GameState {
  readonly config: GameConfig;
  /** 仅用于生成地图与出生点，游戏开始后不再参与随机。 */
  readonly mapSeed: string;
  /** 用于阵容、先手、抽牌等游戏内随机。 */
  readonly gameSeed: string;
  map: MapState;
  spawn: Record<PlayerId, SpawnInfo>;
  roster: Record<PlayerId, CharacterTypeId[]>;
  characters: CharacterState[];
  players: Record<PlayerId, PlayerState>;
  /** 部署阶段双方提交的内容；进入战斗后保留供回放。 */
  deployment: Record<PlayerId, Deployment | null>;
  phase: GamePhase;
  currentPlayer: PlayerId;
  readonly firstPlayer: PlayerId;
  turnIndex: number;
  rng: Record<RngStreamName, RngStreamState>;
  history: ActionRecord[];
  result: GameResult | null;
}

export function characterIdOf(owner: PlayerId, typeId: CharacterTypeId): CharacterId {
  return owner + ':' + typeId;
}

/** 按 id 查找角色；找不到时抛错（调用方应先校验）。 */
export function getCharacter(state: GameState, id: CharacterId): CharacterState {
  const found = state.characters.find((item) => item.id === id);
  if (found === undefined) throw new Error('getCharacter: 未知角色 ' + id);
  return found;
}

export function findCharacter(state: GameState, id: CharacterId): CharacterState | null {
  return state.characters.find((item) => item.id === id) ?? null;
}

export function charactersOf(state: GameState, player: PlayerId): CharacterState[] {
  return state.characters.filter((item) => item.owner === player);
}

export function aliveCharactersOf(state: GameState, player: PlayerId): CharacterState[] {
  return state.characters.filter((item) => item.owner === player && item.alive);
}
