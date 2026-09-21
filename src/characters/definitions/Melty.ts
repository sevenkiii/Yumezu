/** Melty：区域支援 / 区域伤害（「Melty Land」）。见 RULES.md §11.3。 */

/** 「Melty Land」的作用距离。 */
export const MELTY_LAND_RANGE = 1;
/** 对友方角色的回复量。 */
export const MELTY_LAND_HEAL = 2;
/** 对敌方角色的伤害量。 */
export const MELTY_LAND_DAMAGE = 2;

import type { SkillChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { CharacterState, GameState } from '../../core/GameState';
import { otherCharactersWithin } from '../../rules/Targeting';
import type { CharacterDefinition } from '../Character';
import type { SkillDefinition } from '../Skill';

const skill: SkillDefinition = {
  id: 'MeltyLand',
  cd: 2,
  listChoices(state: GameState, actor: CharacterState): SkillChoice[] {
    const affected = otherCharactersWithin(state, actor, MELTY_LAND_RANGE);
    return affected.length > 0 ? [{ kind: 'NONE' as const }] : [];
  },
  buildEffects(state: GameState, actor: CharacterState, _choice: SkillChoice): Effect[] {
    const affected = otherCharactersWithin(state, actor, MELTY_LAND_RANGE);
    const effects: Effect[] = [];
    for (const target of affected) {
      if (target.owner === actor.owner) {
        effects.push({ kind: 'HEAL', targetId: target.id, amount: MELTY_LAND_HEAL });
      } else {
        effects.push({
          kind: 'DAMAGE',
          targetId: target.id,
          amount: MELTY_LAND_DAMAGE,
          source: { kind: 'SKILL', sourceCharacterId: actor.id, sourcePlayerId: actor.owner },
        });
      }
    }
    return effects;
  },
};

export const melty: CharacterDefinition = {
  typeId: 'Melty',
  hp: 10,
  attackDamage: 1,
  moveRange: 2,
  attackRange: 1,
  skill,
};
