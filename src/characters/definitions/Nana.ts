/** Nana：单体爆发（「地球仪」）。见 RULES.md §11.1。 */

/** 「地球仪」的作用距离。与普攻一样都要求相邻（图距离 1）。 */
export const GLOBE_RANGE = 1;
/** 「地球仪」的伤害值。 */
export const GLOBE_DAMAGE = 4;

import type { SkillChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { CharacterState, GameState } from '../../core/GameState';
import { enemiesWithin } from '../../rules/Targeting';
import type { CharacterDefinition } from '../Character';
import type { SkillDefinition } from '../Skill';

const skill: SkillDefinition = {
  id: 'Globe',
  cd: 2,
  listChoices(state: GameState, actor: CharacterState): SkillChoice[] {
    return enemiesWithin(state, actor.owner, actor.position, GLOBE_RANGE).map((target) => ({
      kind: 'SINGLE_TARGET' as const,
      targetId: target.id,
    }));
  },
  buildEffects(_state: GameState, actor: CharacterState, choice: SkillChoice): Effect[] {
    if (choice.kind !== 'SINGLE_TARGET') throw new Error('地球仪需要一个目标');
    return [
      {
        kind: 'DAMAGE',
        targetId: choice.targetId,
        amount: GLOBE_DAMAGE,
        source: { kind: 'SKILL', sourceCharacterId: actor.id, sourcePlayerId: actor.owner },
      },
    ];
  },
};

export const nana: CharacterDefinition = {
  typeId: 'Nana',
  hp: 10,
  attackDamage: 2,
  moveRange: 2,
  /** 普攻与「地球仪」同为 1 格（相邻）。见 RULES.md §11.1。 */
  attackRange: 1,
  skill,
};
