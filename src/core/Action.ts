/**
 * 行动定义。见 RULES.md §1。
 *
 * 一个回合有两个独立槽位：角色操作（移动 / 普攻 / 专属技能，三选一）
 * 与功能牌操作（使用功能牌 / 弃牌，二选一），顺序不限、各最多一次。
 * PASS 立即结束本回合，放弃剩余槽位。
 */

import type {
  CharacterId,
  DeploymentAssignment,
  EdgeKey,
  PlayerId,
  StatusType,
  VertexId,
} from './GameState';

/** 技能参数。不同技能使用不同的 kind。 */
export type SkillChoice =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'SINGLE_TARGET'; readonly targetId: CharacterId }
  | { readonly kind: 'MOVE_THEN_STRIKE'; readonly to: VertexId };

/** 功能牌参数。 */
export type CardChoice =
  | { readonly kind: 'SINGLE_TARGET'; readonly targetId: CharacterId; readonly status?: StatusType }
  | { readonly kind: 'MOVE_TO'; readonly targetId: CharacterId; readonly to: VertexId }
  | { readonly kind: 'EDGE'; readonly edge: EdgeKey }
  | { readonly kind: 'VERTEX'; readonly vertex: VertexId };

export type Action =
  | {
      readonly type: 'DEPLOY';
      readonly player: PlayerId;
      readonly assignments: readonly DeploymentAssignment[];
    }
  | {
      readonly type: 'MOVE';
      readonly player: PlayerId;
      readonly characterId: CharacterId;
      readonly to: VertexId;
    }
  | {
      readonly type: 'ATTACK';
      readonly player: PlayerId;
      readonly characterId: CharacterId;
      readonly targetId: CharacterId;
    }
  | {
      readonly type: 'USE_SKILL';
      readonly player: PlayerId;
      readonly characterId: CharacterId;
      readonly choice: SkillChoice;
    }
  | {
      readonly type: 'USE_CARD';
      readonly player: PlayerId;
      readonly handCardId: string;
      readonly choice: CardChoice;
    }
  | { readonly type: 'PASS'; readonly player: PlayerId }
  | { readonly type: 'DISCARD'; readonly player: PlayerId; readonly handCardId: string };

export type ActionType = Action['type'];

/** 一个回合内的操作槽位；TURN_END 表示立即结束回合。 */
export type ActionSlot = 'CHARACTER' | 'CARD' | 'TURN_END';

/** 这个 Action 占用哪个槽位；DEPLOY 不属于战斗回合，返回 null。 */
export function actionSlotOf(action: Action): ActionSlot | null {
  switch (action.type) {
    case 'MOVE':
    case 'ATTACK':
    case 'USE_SKILL':
      return 'CHARACTER';
    case 'USE_CARD':
    case 'DISCARD':
      return 'CARD';
    case 'PASS':
      return 'TURN_END';
    case 'DEPLOY':
    default:
      return null;
  }
}
