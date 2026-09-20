/**
 * 技能的通用接口。
 *
 * 每个技能只做两件事：列出当前合法的参数、按参数生成 Effect。
 * 技能本身不修改状态（见 RULES.md「总原则」）。
 */

import type { SkillChoice } from '../core/Action';
import type { Effect } from '../core/Effect';
import type { CharacterState, GameState, SkillId } from '../core/GameState';

export interface SkillDefinition {
  readonly id: SkillId;
  /** 中文技能名，例如「地球仪」。 */
  readonly name: string;
  /** 面向玩家的效果描述。 */
  readonly description: string;
  /** 使用后的冷却回合数。 */
  readonly cd: number;
  /**
   * 列出当前所有合法参数。
   * 返回空数组表示该技能此刻不可使用（必须至少产生一个真实效果）。
   */
  listChoices(state: GameState, actor: CharacterState): SkillChoice[];
  /** 生成效果。仅在 choice 来自 listChoices 时调用。 */
  buildEffects(state: GameState, actor: CharacterState, choice: SkillChoice): Effect[];
}
