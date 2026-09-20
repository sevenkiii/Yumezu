/** 标记：下一次受到伤害 +1。见 RULES.md §12。 */

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { aliveEnemies } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const mark: CardDefinition = {
  id: 'Mark',
  name: '标记',
  description: '选择一名敌方角色，使其获得【标记】。',
  category: 'ATTACK',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    return aliveEnemies(state, player)
      .filter((enemy) => !enemy.statuses.Marked)
      .map((enemy) => ({ kind: 'SINGLE_TARGET' as const, targetId: enemy.id }));
  },
  buildEffects(_state: GameState, _player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'SINGLE_TARGET') throw new Error('标记需要一个目标');
    return [{ kind: 'ADD_STATUS', targetId: choice.targetId, status: 'Marked' }];
  },
};
