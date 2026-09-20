/** 瞬步：己方角色移动至多 3 格。见 RULES.md §12。 */

/** 瞬步的最大移动距离。 */
export const BLINK_RANGE = 3;

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { reachableDestinationsExcludingSelf } from '../../rules/MovementRules';
import { aliveAllies } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const blink: CardDefinition = {
  id: 'Blink',
  name: '瞬步',
  description: '选择一名己方角色，将其移动至距离不超过 3 的节点。',
  category: 'MOVEMENT',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    const choices: CardChoice[] = [];
    for (const ally of aliveAllies(state, player)) {
      for (const to of reachableDestinationsExcludingSelf(state, ally, BLINK_RANGE)) {
        choices.push({ kind: 'MOVE_TO', targetId: ally.id, to });
      }
    }
    return choices;
  },
  buildEffects(_state: GameState, _player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'MOVE_TO') throw new Error('瞬步需要一个落点');
    return [{ kind: 'RELOCATE', targetId: choice.targetId, to: choice.to, cause: 'CARD' }];
  },
};
