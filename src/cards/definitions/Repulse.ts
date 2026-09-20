/** 排斥：敌方角色移动到相邻节点。见 RULES.md §12。 */

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { edgeKey, neighbors } from '../../map/Graph';
import { blockedEdgeSet } from '../../rules/MovementRules';
import { aliveEnemies, isOccupied } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const repulse: CardDefinition = {
  id: 'Repulse',
  name: '排斥',
  description: '选择一名敌方角色，将其移动到相邻的一个合法节点。',
  category: 'MOVEMENT',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    const blocked = blockedEdgeSet(state);
    const choices: CardChoice[] = [];
    for (const enemy of aliveEnemies(state, player)) {
      for (const to of neighbors(state.map.graph, enemy.position)) {
        if (blocked.has(edgeKey(enemy.position, to))) continue;
        if (isOccupied(state, to)) continue;
        choices.push({ kind: 'MOVE_TO', targetId: enemy.id, to });
      }
    }
    return choices;
  },
  buildEffects(_state: GameState, _player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'MOVE_TO') throw new Error('排斥需要一个落点');
    return [{ kind: 'RELOCATE', targetId: choice.targetId, to: choice.to, cause: 'CARD' }];
  },
};
