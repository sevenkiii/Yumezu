/** 封路：封锁一条边（对手 2 次行动 + 自己 1 次行动）。见 RULES.md §12。 */

/** 封锁持续的行动次数。 */
export const BLOCK_DURATION_ACTIONS = 3;

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { edgeKeyOf } from '../../map/Graph';
import { blockedEdgeSet } from '../../rules/MovementRules';
import type { CardDefinition } from '../Card';

export const blockRoad: CardDefinition = {
  id: 'BlockRoad',
  name: '封路',
  description: '选择地图上的一条边，暂时封锁它。',
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
        durationActions: BLOCK_DURATION_ACTIONS,
      },
    ];
  },
};
