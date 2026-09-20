/** Lily：位置操纵（「换位」）。见 RULES.md §11.2。 */

/** 「换位」的作用距离（裁决：由设计稿的 2 提升为 3）。 */
export const SWAP_RANGE = 3;

import type { SkillChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { CharacterState, GameState } from '../../core/GameState';
import { otherCharactersWithin } from '../../rules/Targeting';
import type { CharacterDefinition } from '../Character';
import type { SkillDefinition } from '../Skill';

const skill: SkillDefinition = {
  id: 'Swap',
  name: '换位',
  description: '选择距离不超过 3 的一名其他角色（友方或敌方），与其交换位置。',
  cd: 2,
  listChoices(state: GameState, actor: CharacterState): SkillChoice[] {
    return otherCharactersWithin(state, actor, SWAP_RANGE).map((target) => ({
      kind: 'SINGLE_TARGET' as const,
      targetId: target.id,
    }));
  },
  buildEffects(_state: GameState, actor: CharacterState, choice: SkillChoice): Effect[] {
    if (choice.kind !== 'SINGLE_TARGET') throw new Error('换位需要一个目标');
    return [{ kind: 'SWAP', a: actor.id, b: choice.targetId }];
  },
};

export const lily: CharacterDefinition = {
  typeId: 'Lily',
  name: 'Lily',
  hp: 10,
  attackDamage: 2,
  moveRange: 2,
  attackRange: 2,
  skill,
};
