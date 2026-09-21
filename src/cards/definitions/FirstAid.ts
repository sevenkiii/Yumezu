/** 急救：己方单体回复 3 HP。见 RULES.md §12。 */

/** 急救的回复量。 */
export const FIRST_AID_HEAL = 3;

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { aliveAllies } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const firstAid: CardDefinition = {
  id: 'FirstAid',
  category: 'DEFENSE',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    return aliveAllies(state, player)
      .filter((ally) => ally.hp < ally.maxHp)
      .map((ally) => ({ kind: 'SINGLE_TARGET' as const, targetId: ally.id }));
  },
  buildEffects(_state: GameState, _player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'SINGLE_TARGET') throw new Error('急救需要一个目标');
    return [{ kind: 'HEAL', targetId: choice.targetId, amount: FIRST_AID_HEAL }];
  },
};
