/** 强袭：下一次普通攻击 +1。见 RULES.md §12。 */

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { aliveAllies } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const assault: CardDefinition = {
  id: 'Assault',
  name: '强袭',
  description: '选择一名己方角色，使其获得【强袭】。',
  category: 'ATTACK',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    return aliveAllies(state, player)
      .filter((ally) => !ally.statuses.Empowered)
      .map((ally) => ({ kind: 'SINGLE_TARGET' as const, targetId: ally.id }));
  },
  buildEffects(_state: GameState, _player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'SINGLE_TARGET') throw new Error('强袭需要一个目标');
    return [{ kind: 'ADD_STATUS', targetId: choice.targetId, status: 'Empowered' }];
  },
};
