/** 封技：下一次行动不能使用专属技能。见 RULES.md §12。 */

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { aliveEnemies } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const sealSkill: CardDefinition = {
  id: 'SealSkill',
  category: 'CONTROL',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    return aliveEnemies(state, player)
      .filter((enemy) => !enemy.statuses.SkillSealed)
      .map((enemy) => ({ kind: 'SINGLE_TARGET' as const, targetId: enemy.id }));
  },
  buildEffects(_state: GameState, _player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'SINGLE_TARGET') throw new Error('封技需要一个目标');
    return [{ kind: 'ADD_STATUS', targetId: choice.targetId, status: 'SkillSealed' }];
  },
};
