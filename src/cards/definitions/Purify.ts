/** 净化：移除一个负面状态。见 RULES.md §12。 */

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { NEGATIVE_STATUS_TYPES } from '../../core/GameState';
import { aliveAllies } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const purify: CardDefinition = {
  id: 'Purify',
  category: 'DEFENSE',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    const choices: CardChoice[] = [];
    for (const ally of aliveAllies(state, player)) {
      for (const status of NEGATIVE_STATUS_TYPES) {
        if (ally.statuses[status]) {
          choices.push({ kind: 'SINGLE_TARGET', targetId: ally.id, status });
        }
      }
    }
    return choices;
  },
  buildEffects(_state: GameState, _player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'SINGLE_TARGET' || choice.status === undefined) {
      throw new Error('净化需要一个负面状态');
    }
    return [{ kind: 'REMOVE_STATUS', targetId: choice.targetId, status: choice.status }];
  },
};
