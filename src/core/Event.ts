/**
 * 事件：结算过程的完整记录，用于 Action Log、调试与 UI 表现。
 */

import type { Action } from './Action';
import type { RelocateCause } from './Effect';
import type { DamageSource } from './Effect';
import type {
  CardId,
  CharacterId,
  CharacterTypeId,
  Deployment,
  EdgeKey,
  GameResult,
  PlayerId,
  StatusType,
  VertexId,
} from './GameState';

export type GameEvent =
  | {
      readonly type: 'GAME_START';
      readonly firstPlayer: PlayerId;
      readonly roster: Record<PlayerId, CharacterTypeId[]>;
    }
  | { readonly type: 'DEPLOY_SUBMITTED'; readonly player: PlayerId }
  | { readonly type: 'DEPLOY_REVEALED'; readonly deployment: Record<PlayerId, Deployment> }
  | { readonly type: 'TURN_START'; readonly player: PlayerId; readonly turnIndex: number }
  | {
      readonly type: 'COOLDOWN_TICKED';
      readonly characterId: CharacterId;
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly type: 'CARD_DRAWN';
      readonly player: PlayerId;
      readonly cardId: CardId;
      readonly handSize: number;
    }
  | { readonly type: 'CARD_PLAYED'; readonly player: PlayerId; readonly cardId: CardId }
  | { readonly type: 'CARD_DISCARDED'; readonly player: PlayerId; readonly cardId: CardId }
  | { readonly type: 'EDGE_BLOCK_EXPIRED'; readonly edge: EdgeKey; readonly owner: PlayerId }
  | {
      readonly type: 'MOVED';
      readonly characterId: CharacterId;
      readonly from: VertexId;
      readonly to: VertexId;
      readonly cause: RelocateCause;
    }
  | { readonly type: 'SWAPPED'; readonly a: CharacterId; readonly b: CharacterId }
  | {
      readonly type: 'DAMAGED';
      readonly targetId: CharacterId;
      readonly amount: number;
      readonly hpAfter: number;
      readonly source: DamageSource;
    }
  | {
      readonly type: 'HEALED';
      readonly targetId: CharacterId;
      readonly amount: number;
      readonly hpAfter: number;
    }
  | { readonly type: 'STATUS_ADDED'; readonly targetId: CharacterId; readonly status: StatusType }
  | { readonly type: 'STATUS_REMOVED'; readonly targetId: CharacterId; readonly status: StatusType }
  | {
      readonly type: 'COOLDOWN_MODIFIED';
      readonly targetId: CharacterId;
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly type: 'EDGE_BLOCKED';
      readonly edge: EdgeKey;
      readonly owner: PlayerId;
      readonly expiresAtTurnIndex: number;
    }
  | { readonly type: 'EDGE_UNBLOCKED'; readonly edge: EdgeKey }
  | { readonly type: 'TRAP_PLACED'; readonly owner: PlayerId; readonly vertex: VertexId }
  | {
      readonly type: 'TRAP_TRIGGERED';
      readonly owner: PlayerId;
      readonly vertex: VertexId;
      readonly targetId: CharacterId;
    }
  | { readonly type: 'SHADOW_MARK_SET'; readonly targetId: CharacterId; readonly vertex: VertexId }
  | {
      readonly type: 'SHADOW_RETURN';
      readonly targetId: CharacterId;
      readonly vertex: VertexId;
      readonly success: boolean;
    }
  | { readonly type: 'CHARACTER_DIED'; readonly characterId: CharacterId }
  | { readonly type: 'GAME_END'; readonly result: GameResult };

export type GameEventType = GameEvent['type'];

/** 只保留指定类型的事件，便于测试与调试。 */
export function filterEvents<T extends GameEventType>(
  events: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}

/** 事件里是否出现某条行动。 */
export function actionOf(record: { action: Action }): Action {
  return record.action;
}
