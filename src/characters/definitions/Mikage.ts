/** Mikage：预判 / 防守反制（「影返」）。见 RULES.md §11.4。 */

import type { SkillChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { CharacterState, GameState } from '../../core/GameState';
import type { CharacterDefinition } from '../Character';
import type { SkillDefinition } from '../Skill';

const skill: SkillDefinition = {
  id: 'ShadowReturn',
  name: '影返',
  description:
    '在当前位置留下影标记：直到触发或被重新使用前，第一次受到的伤害减 1，随后立即返回影标记。',
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
  name: 'Mikage',
  hp: 12,
  attackDamage: 2,
  moveRange: 1,
  attackRange: 1,
  skill,
};
