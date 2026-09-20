/**
 * 功能牌的通用接口。
 *
 * 每张牌只做两件事：列出当前合法的参数、按参数生成 Effect。
 * 使用功能牌本身消耗一次行动（RULES.md §12）。
 */

import type { CardChoice } from '../core/Action';
import type { Effect } from '../core/Effect';
import type { CardId, GameState, PlayerId } from '../core/GameState';
import { CARD_DEFINITIONS } from './definitions';

export type CardCategory = 'ATTACK' | 'DEFENSE' | 'MOVEMENT' | 'CONTROL' | 'MAP' | 'TEMPO';

export interface CardDefinition {
  readonly id: CardId;
  /** 中文牌名，例如「急救」。 */
  readonly name: string;
  readonly description: string;
  readonly category: CardCategory;
  /**
   * 列出当前所有合法参数。
   * 返回空数组表示这张牌此刻不可使用（必须至少产生一个真实效果）。
   */
  listChoices(state: GameState, player: PlayerId): CardChoice[];
  /** 生成效果。仅在 choice 来自 listChoices 时调用。 */
  buildEffects(state: GameState, player: PlayerId, choice: CardChoice): Effect[];
}

export function cardDefinition(id: CardId): CardDefinition {
  const found = CARD_DEFINITIONS[id];
  if (found === undefined) throw new Error('cardDefinition: 未知功能牌 ' + id);
  return found;
}
