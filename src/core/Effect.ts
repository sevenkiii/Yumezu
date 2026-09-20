/**
 * 统一效果系统。见 RULES.md §9 与设计稿的 Effect 列表。
 *
 * 技能与功能牌都不直接修改状态，而是产生 Effect，
 * 由 rules/EffectResolver.ts 统一按队列顺序结算。
 */

import type { CharacterId, EdgeKey, PlayerId, StatusType, VertexId } from './GameState';

/** 伤害来源。用于「强袭」（仅普通攻击）与敌对关系判定。 */
export interface DamageSource {
  readonly kind: 'ATTACK' | 'SKILL' | 'CARD' | 'TRAP';
  readonly sourceCharacterId: CharacterId | null;
  readonly sourcePlayerId: PlayerId;
}

/** 位移原因，主要用于事件记录。 */
export type RelocateCause = 'MOVE' | 'CARD' | 'SKILL' | 'SHADOW_RETURN';

export type Effect =
  | {
      readonly kind: 'DAMAGE';
      readonly targetId: CharacterId;
      readonly amount: number;
      readonly source: DamageSource;
    }
  | { readonly kind: 'HEAL'; readonly targetId: CharacterId; readonly amount: number }
  | {
      readonly kind: 'RELOCATE';
      readonly targetId: CharacterId;
      readonly to: VertexId;
      readonly cause: RelocateCause;
    }
  | { readonly kind: 'SWAP'; readonly a: CharacterId; readonly b: CharacterId }
  | { readonly kind: 'ADD_STATUS'; readonly targetId: CharacterId; readonly status: StatusType }
  | { readonly kind: 'REMOVE_STATUS'; readonly targetId: CharacterId; readonly status: StatusType }
  | { readonly kind: 'MODIFY_COOLDOWN'; readonly targetId: CharacterId; readonly delta: number }
  | {
      readonly kind: 'BLOCK_EDGE';
      readonly edge: EdgeKey;
      readonly owner: PlayerId;
      readonly durationActions: number;
    }
  | { readonly kind: 'PLACE_TRAP'; readonly owner: PlayerId; readonly vertex: VertexId }
  | { readonly kind: 'SET_SHADOW_MARK'; readonly targetId: CharacterId; readonly vertex: VertexId };

export type EffectKind = Effect['kind'];
