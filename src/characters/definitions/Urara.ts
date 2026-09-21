/** Urara：区域控制（「冻结」）。见 RULES.md §11.6。 */

/** 「冻结」的作用距离。 */
export const FREEZE_RANGE = 1;

import type { SkillChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { CharacterState, GameState } from '../../core/GameState';
import { enemiesWithin } from '../../rules/Targeting';
import type { CharacterDefinition } from '../Character';
import type { SkillDefinition } from '../Skill';

const skill: SkillDefinition = {
  id: 'Freeze',
  cd: 2,
  listChoices(state: GameState, actor: CharacterState): SkillChoice[] {
    const targets = enemiesWithin(state, actor.owner, actor.position, FREEZE_RANGE).filter(
      (target) => !target.statuses.Frozen,
    );
    return targets.length > 0 ? [{ kind: 'NONE' as const }] : [];
  },
  buildEffects(state: GameState, actor: CharacterState, _choice: SkillChoice): Effect[] {
    const targets = enemiesWithin(state, actor.owner, actor.position, FREEZE_RANGE).filter(
      (target) => !target.statuses.Frozen,
    );
    return targets.map((target) => ({
      kind: 'ADD_STATUS' as const,
      targetId: target.id,
      status: 'Frozen' as const,
    }));
  },
};

export const urara: CharacterDefinition = {
  typeId: 'Urara',
  hp: 10,
  attackDamage: 2,
  moveRange: 2,
  attackRange: 1,
  skill,
};
