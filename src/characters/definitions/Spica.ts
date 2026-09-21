/** Spica：高机动突袭（「星奔」）。见 RULES.md §11.5。 */

/** 「星奔」的移动距离。 */
export const STAR_DASH_RANGE = 3;
/** 「星奔」第二段对每个目标的伤害。 */
export const STAR_DASH_DAMAGE = 1;
/** 「星奔」第二段的攻击距离（图距离）。 */
export const STAR_DASH_STRIKE_RANGE = 1;

import type { SkillChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { CharacterState, GameState } from '../../core/GameState';
import { reachableDestinations } from '../../rules/MovementRules';
import { enemiesWithin } from '../../rules/Targeting';
import type { CharacterDefinition } from '../Character';
import type { SkillDefinition } from '../Skill';

const skill: SkillDefinition = {
  id: 'StarDash',
  cd: 2,
  listChoices(state: GameState, actor: CharacterState): SkillChoice[] {
    if (actor.statuses.Frozen) return [];
    const destinations = reachableDestinations(state, actor, STAR_DASH_RANGE);
    return destinations.map((to) => ({ kind: 'MOVE_THEN_STRIKE' as const, to }));
  },
  buildEffects(state: GameState, actor: CharacterState, choice: SkillChoice): Effect[] {
    if (choice.kind !== 'MOVE_THEN_STRIKE') throw new Error('星奔需要一个落点');
    const effects: Effect[] = [
      { kind: 'RELOCATE', targetId: actor.id, to: choice.to, cause: 'SKILL' },
    ];
    const targets = enemiesWithin(state, actor.owner, choice.to, STAR_DASH_STRIKE_RANGE);
    for (const target of targets) {
      effects.push({
        kind: 'DAMAGE',
        targetId: target.id,
        amount: STAR_DASH_DAMAGE,
        source: { kind: 'SKILL', sourceCharacterId: actor.id, sourcePlayerId: actor.owner },
      });
    }
    return effects;
  },
};

export const spica: CharacterDefinition = {
  typeId: 'Spica',
  hp: 8,
  attackDamage: 2,
  moveRange: 3,
  attackRange: 1,
  skill,
};
