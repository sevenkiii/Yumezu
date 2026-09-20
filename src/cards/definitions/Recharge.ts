/** 充能：一个正在冷却的技能 CD 减 1。见 RULES.md §12。 */

/** 每次充能减少的 CD。 */
export const RECHARGE_AMOUNT = 1;

import type { CardChoice } from '../../core/Action';
import type { Effect } from '../../core/Effect';
import type { GameState, PlayerId } from '../../core/GameState';
import { aliveAllies } from '../../rules/Targeting';
import type { CardDefinition } from '../Card';

export const recharge: CardDefinition = {
  id: 'Recharge',
  name: '充能',
  description: '选择一名己方角色，使其一个正在冷却的技能剩余 CD 减少 1。',
  category: 'TEMPO',
  listChoices(state: GameState, player: PlayerId): CardChoice[] {
    return aliveAllies(state, player)
      .filter((ally) => ally.skillCd >= 1)
      .map((ally) => ({ kind: 'SINGLE_TARGET' as const, targetId: ally.id }));
  },
  buildEffects(_state: GameState, _player: PlayerId, choice: CardChoice): Effect[] {
    if (choice.kind !== 'SINGLE_TARGET') throw new Error('充能需要一个目标');
    return [{ kind: 'MODIFY_COOLDOWN', targetId: choice.targetId, delta: -RECHARGE_AMOUNT }];
  },
};
