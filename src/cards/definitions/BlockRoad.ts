/** 封路：封锁一条边，持续 2 个回合。见 RULES.md §12。 */

/** 封锁持续的回合数；turnIndex 以回合为单位（RULES.md §16）。 */
export const BLOCK_DURATION_TURNS = 2;

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { edgeKeyOf } from '../../map/Graph';
import { blockedEdgeSet } from '../../rules/MovementRules';
import type { CardDefinition } from '../Card';

export const blockRoad: CardDefinition = {
  id: 'BlockRoad',
  category: 'MAP',
  listChoices(state: GameState, _player: PlayerId): CardChoice[] {
    const blocked = blockedEdgeSet(state);
    return state.map.graph.edges
      .map((edge) => edgeKeyOf(edge))
      .filter((key) => !blocked.has(key))
      .map((key) => ({ kind: 'EDGE' as const, edge: key }));
  },
  buildEffects(_state: GameState, player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'EDGE') throw new Error('封路需要一条边');
    return [
      {
        kind: 'BLOCK_EDGE',
        edge: choice.edge,
        owner: player,
        durationTurns: BLOCK_DURATION_TURNS,
      },
    ];
  },
};
