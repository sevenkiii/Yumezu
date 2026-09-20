/**
 * 行动定义。见 RULES.md §1。
 *
 * 一次行动只能做一个主要操作：移动 / 普攻 / 专属技能 / 使用功能牌，
 * 另加 PASS（放弃）与 DISCARD（弃牌）两种兜底操作。
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

/** 参与角色行动（会消耗该角色状态）的行动类型。 */
export function actingCharacterId(action: Action): CharacterId | null {
  switch (action.type) {
    case 'MOVE':
    case 'ATTACK':
    case 'USE_SKILL':
      return action.characterId;
    default:
      return null;
  }
}
