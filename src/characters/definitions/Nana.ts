/** Nana：单体爆发（「地球仪」）。见 RULES.md §11.1。 */

/** 「地球仪」的作用距离。 */
export const GLOBE_RANGE = 2;
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
  name: '地球仪',
  description: '对距离不超过 2 的一名敌方角色造成 4 点伤害。',
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
  name: 'Nana',
  hp: 10,
  attackDamage: 2,
  moveRange: 2,
  attackRange: 1,
  skill,
};
