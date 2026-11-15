/** Mikage：预判 / 防守反制（「影返」）。见 RULES.md §11.4。 */

/** 「影返」触发时对当次伤害的减算量。见 RULES.md §9 / §11.4。 */
export const SHADOW_RETURN_REDUCTION = 2;

import type { SkillChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { CharacterState, GameState } from '../../core/GameState';
import type { CharacterDefinition } from '../Character';
import type { SkillDefinition } from '../Skill';

const skill: SkillDefinition = {
  id: 'ShadowReturn',
  cd: 2,
  listChoices(_state: GameState, _actor: CharacterState): SkillChoice[] {
    return [{ kind: 'NONE' as const }];
  },
  buildEffects(_state: GameState, actor: CharacterState, _choice: SkillChoice): Effect[] {
    return [{ kind: 'SET_SHADOW_MARK', targetId: actor.id, vertex: actor.position }];
  },
};

export const mikage: CharacterDefinition = {
  typeId: 'Mikage',
  hp: 12,
  attackDamage: 2,
  moveRange: 2,
  attackRange: 1,
  skill,
};
