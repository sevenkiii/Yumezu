/** 护盾：下一次受到伤害减 2。见 RULES.md §12。 */

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { aliveAllies } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const shield: CardDefinition = {
  id: 'Shield',
  category: 'DEFENSE',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    return aliveAllies(state, player)
      .filter((ally) => !ally.statuses.Shielded)
      .map((ally) => ({ kind: 'SINGLE_TARGET' as const, targetId: ally.id }));
  },
  buildEffects(_state: GameState, _player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'SINGLE_TARGET') throw new Error('护盾需要一个目标');
    return [{ kind: 'ADD_STATUS', targetId: choice.targetId, status: 'Shielded' }];
  },
};
