import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import { applyAction, getLegalActions } from '../src/core/GameEngine';
import type { CardId, GameState } from '../src/core/GameState';
import { findCharacter } from '../src/core/GameState';
import { blockedEdgeSet } from '../src/rules/MovementRules';
import { createBattleState } from './support/fixtures';

function cardActions(state: GameState, cardId: CardId): Action[] {
  const hand = state.players[state.currentPlayer].hand;
  const card = hand.find((item) => item.cardId === cardId);
  if (card === undefined) return [];
  return getLegalActions(state).filter(
    (action) => action.type === 'USE_CARD' && action.handCardId === card.id,
  );
}

function passOnce(state: GameState): GameState {
  const action = getLegalActions(state).find((item) => item.type === 'PASS') as Action;
  return applyAction(state, action).state;
}

function base(
  hands: { P1?: CardId[]; P2?: CardId[] },
  positions?: Record<string, number>,
): GameState {
  return createBattleState({
    p1: ['Nana', 'Lily', 'Melty'],
    p2: ['Nana', 'Lily', 'Melty'],
    positions: positions ?? {
      'P1:Nana': 0,
      'P1:Lily': 13,
      'P1:Melty': 14,
      'P2:Nana': 1,
      'P2:Lily': 23,
      'P2:Melty': 28,
    },
    hands,
    currentPlayer: 'P1',
  });
}

describe('功能牌', () => {
  it('急救：回复 3 HP 且不超过上限；满血目标不可选', () => {
    const state = base({ P1: ['FirstAid'] });
    const nana = findCharacter(state, 'P1:Nana');
    if (nana === null) throw new Error('missing');
    nana.hp = 6;
    const actions = cardActions(state, 'FirstAid');
    expect(actions).toHaveLength(1);
    const next = applyAction(state, actions[0] as Action).state;
    expect(findCharacter(next, 'P1:Nana')?.hp).toBe(9);

    const full = base({ P1: ['FirstAid'] });
    expect(cardActions(full, 'FirstAid')).toHaveLength(0);
  });

  it('护盾：获得护盾，且不能对已有护盾的角色重复使用', () => {
    const state = base({ P1: ['Shield'] });
    const actions = cardActions(state, 'Shield');
    expect(actions).toHaveLength(3);
    const next = applyAction(state, actions[0] as Action).state;
    const shielded = next.characters.filter((character) => character.statuses.Shielded);
    expect(shielded).toHaveLength(1);
  });

  it('强袭：获得强袭', () => {
    const state = base({ P1: ['Assault'] });
    const next = applyAction(state, cardActions(state, 'Assault')[0] as Action).state;
    expect(next.characters.some((character) => character.statuses.Empowered)).toBe(true);
  });

  it('充能：使冷却中的技能 CD 减 1；没有冷却目标时不可用', () => {
    const state = base({ P1: ['Recharge'] });
    expect(cardActions(state, 'Recharge')).toHaveLength(0);
    const nana = findCharacter(state, 'P1:Nana');
    if (nana === null) throw new Error('missing');
    nana.skillCd = 2;
    const next = applyAction(state, cardActions(state, 'Recharge')[0] as Action).state;
    expect(findCharacter(next, 'P1:Nana')?.skillCd).toBe(1);
  });

  it('净化：移除一个负面状态', () => {
    const state = base({ P1: ['Purify'] });
    const nana = findCharacter(state, 'P1:Nana');
    if (nana === null) throw new Error('missing');
    nana.statuses.Frozen = true;
    nana.statuses.Marked = true;
    const actions = cardActions(state, 'Purify');
    expect(actions).toHaveLength(2);
    const frozenOnly = actions.find(
      (action) =>
        action.type === 'USE_CARD' &&
        action.choice.kind === 'SINGLE_TARGET' &&
        action.choice.status === 'Frozen',
    ) as Action;
    const next = applyAction(state, frozenOnly).state;
    expect(findCharacter(next, 'P1:Nana')?.statuses.Frozen).toBe(false);
    expect(findCharacter(next, 'P1:Nana')?.statuses.Marked).toBe(true);
  });

  it('瞬步：己方角色移动至多 3 格', () => {
    const state = base({ P1: ['Blink'] });
    const actions = cardActions(state, 'Blink');
    const jump = actions.find(
      (action) =>
        action.type === 'USE_CARD' &&
        action.choice.kind === 'MOVE_TO' &&
        action.choice.targetId === 'P1:Nana' &&
        action.choice.to === 12,
    ) as Action;
    expect(jump).toBeDefined();
    const next = applyAction(state, jump).state;
    expect(findCharacter(next, 'P1:Nana')?.position).toBe(12);
  });

  it('排斥：把敌方移动到相邻节点', () => {
    const state = base({ P1: ['Repulse'] });
    const actions = cardActions(state, 'Repulse');
    const push = actions.find(
      (action) =>
        action.type === 'USE_CARD' &&
        action.choice.kind === 'MOVE_TO' &&
        action.choice.targetId === 'P2:Nana' &&
        action.choice.to === 2,
    ) as Action;
    expect(push).toBeDefined();
    const next = applyAction(state, push).state;
    expect(findCharacter(next, 'P2:Nana')?.position).toBe(2);
  });

  it('封路：封锁边在接下来的 3 次行动内有效，第 4 次行动开始时解除', () => {
    const state = base({ P1: ['BlockRoad'] });
    const actions = cardActions(state, 'BlockRoad');
    const block = actions.find(
      (action) =>
        action.type === 'USE_CARD' && action.choice.kind === 'EDGE' && action.choice.edge === '0-1',
    ) as Action;
    expect(block).toBeDefined();
    let current = applyAction(state, block).state;
    expect(blockedEdgeSet(current).has('0-1')).toBe(true);

    current = passOnce(current);
    current = passOnce(current);
    current = passOnce(current);
    expect(blockedEdgeSet(current).has('0-1')).toBe(true);

    current = passOnce(current);
    expect(blockedEdgeSet(current).has('0-1')).toBe(false);
  });

  it('标记 / 封技：赋予敌方负面状态', () => {
    const state = base({ P1: ['Mark', 'SealSkill'] });
    const markAction = cardActions(state, 'Mark')[0] as Action;
    let next = applyAction(state, markAction).state;
    expect(next.characters.filter((character) => character.statuses.Marked)).toHaveLength(1);

    const sealState = base({ P1: ['SealSkill'] });
    next = applyAction(sealState, cardActions(sealState, 'SealSkill')[0] as Action).state;
    expect(next.characters.filter((character) => character.statuses.SkillSealed)).toHaveLength(1);
  });

  it('陷阱：放在空节点，敌方进入时受到 2 点伤害', () => {
    const state = base(
      { P1: ['Trap'] },
      {
        'P1:Nana': 0,
        'P1:Lily': 13,
        'P1:Melty': 14,
        'P2:Nana': 4,
        'P2:Lily': 23,
        'P2:Melty': 28,
      },
    );
    const actions = cardActions(state, 'Trap');
    const place = actions.find(
      (action) =>
        action.type === 'USE_CARD' && action.choice.kind === 'VERTEX' && action.choice.vertex === 5,
    ) as Action;
    expect(place).toBeDefined();
    let current = applyAction(state, place).state;
    expect(current.map.traps).toHaveLength(1);

    const move = getLegalActions(current).find(
      (action) => action.type === 'MOVE' && action.characterId === 'P2:Nana' && action.to === 5,
    ) as Action;
    expect(move).toBeDefined();
    current = applyAction(current, move).state;
    expect(findCharacter(current, 'P2:Nana')?.hp).toBe(8);
    expect(current.map.traps).toHaveLength(0);
  });

  it('同一玩家同时只能有 1 个陷阱', () => {
    const state = base({ P1: ['Trap'] });
    state.map.traps.push({ id: 'T1', owner: 'P1', vertex: 29 });
    expect(cardActions(state, 'Trap')).toHaveLength(0);
  });
});
