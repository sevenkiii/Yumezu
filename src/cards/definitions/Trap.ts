/** 陷阱：在空节点放置陷阱，敌方进入时受到 2 点伤害。见 RULES.md §12。 */

/** 陷阱的伤害。 */
export const TRAP_DAMAGE = 2;
/** 每名玩家同时最多存在的陷阱数。 */
export const MAX_TRAPS_PER_PLAYER = 1;

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { isOccupied } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const trap: CardDefinition = {
  id: 'Trap',
  category: 'MAP',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    const owned = state.map.traps.filter((trap) => trap.owner === player).length;
    if (owned >= MAX_TRAPS_PER_PLAYER) return [];
    const choices: CardChoice[] = [];
    for (const vertex of state.map.graph.vertices) {
      if (isOccupied(state, vertex.id)) continue;
      choices.push({ kind: 'VERTEX', vertex: vertex.id });
    }
    return choices;
  },
  buildEffects(_state: GameState, player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'VERTEX') throw new Error('陷阱需要一个节点');
    return [{ kind: 'PLACE_TRAP', owner: player, vertex: choice.vertex }];
  },
};
