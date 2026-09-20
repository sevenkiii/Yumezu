/**
 * 战斗规则：伤害结算管线。见 RULES.md §9。
 *
 * 顺序固定为：加算（强袭 / 标记）→ 减算（护盾 / 影返）→ 钳位到 0。
 * 本模块只做计算，不修改状态；状态的消耗由 EffectResolver 负责。
 */

import type { DamageSource } from '../core/Effect';
import type { CharacterState, GameState } from '../core/GameState';
import { findCharacter } from '../core/GameState';

export interface DamagePlan {
  /** 钳位后的最终伤害。 */
  readonly amount: number;
  /** 是否消耗攻击者的【强袭】。 */
  readonly consumedEmpowered: boolean;
  /** 是否消耗受方的【标记】。 */
  readonly consumedMarked: boolean;
  /** 是否消耗受方的【护盾】。 */
  readonly consumedShielded: boolean;
  /** 是否触发受方的「影返」。 */
  readonly triggeredShadow: boolean;
}

export function computeDamage(
  state: GameState,
  target: CharacterState,
  baseAmount: number,
  source: DamageSource,
): DamagePlan {
  const attacker =
    source.sourceCharacterId === null ? null : findCharacter(state, source.sourceCharacterId);
  const empowered = source.kind === 'ATTACK' && attacker !== null && attacker.statuses.Empowered;

  let amount = baseAmount;
  if (empowered) amount += 1;
  if (target.statuses.Marked) amount += 1;
  if (target.statuses.Shielded) amount -= 2;
  const triggeredShadow = target.shadowMark !== null;
  if (triggeredShadow) amount -= 1;

  return {
    amount: Math.max(0, amount),
    consumedEmpowered: empowered,
    consumedMarked: target.statuses.Marked,
    consumedShielded: target.statuses.Shielded,
    triggeredShadow,
  };
}
