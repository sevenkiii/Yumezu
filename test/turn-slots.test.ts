/**
 * 双操作槽回合（RULES.md §1 / §7 / §16）。
 *
 * 一个回合 = 角色操作 ×1 + 功能牌操作 ×1，顺序不限；
 * 两个槽位都用完或 PASS 才换人，turnIndex 以「回合」为单位递增。
 */

import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import { applyAction, getLegalActions, validateAction } from '../src/core/GameEngine';
import type { GameState } from '../src/core/GameState';
import { findCharacter } from '../src/core/GameState';
import { getViewFor } from '../src/core/View';
import { blockedEdgeSet } from '../src/rules/MovementRules';
import { createBattleState } from './support/fixtures';

function battle(hand: readonly ('FirstAid' | 'Shield' | 'BlockRoad')[] = ['Shield']): GameState {
  return createBattleState({
    p1: ['Nana', 'Lily', 'Melty'],
    p2: ['Nana', 'Lily', 'Melty'],
    positions: {
      'P1:Nana': 0,
      'P1:Lily': 13,
      'P1:Melty': 14,
      // 与 P1:Nana 相邻，保证普攻 / 地球仪有合法目标
      'P2:Nana': 1,
      'P2:Lily': 23,
      'P2:Melty': 28,
    },
    hands: { P1: hand, P2: [] },
    currentPlayer: 'P1',
  });
}

function first(state: GameState, type: Action['type']): Action {
  const action = getLegalActions(state).find((item) => item.type === type);
  if (action === undefined) throw new Error('测试局面里没有 ' + type);
  return action;
}

function pass(state: GameState): GameState {
  return applyAction(state, first(state, 'PASS')).state;
}

describe('一个回合两个操作槽位', () => {
  it('角色操作 → 功能牌操作：第二个操作才结束回合', () => {
    const state = battle();
    const moved = applyAction(state, first(state, 'MOVE')).state;

    expect(moved.currentPlayer).toBe('P1');
    expect(moved.turnIndex).toBe(state.turnIndex);
    expect(moved.turnSlots).toEqual({ character: true, card: false });

    const remaining = getLegalActions(moved);
    expect(remaining.some((action) => action.type === 'MOVE')).toBe(false);
    expect(remaining.some((action) => action.type === 'ATTACK')).toBe(false);
    expect(remaining.some((action) => action.type === 'USE_SKILL')).toBe(false);
    expect(remaining.some((action) => action.type === 'USE_CARD')).toBe(true);
    expect(remaining.some((action) => action.type === 'PASS')).toBe(true);

    const result = applyAction(moved, first(moved, 'USE_CARD'));
    expect(result.state.currentPlayer).toBe('P2');
    expect(result.state.turnIndex).toBe(state.turnIndex + 1);
    // 换人时回合开始重置两个槽位
    expect(result.state.turnSlots).toEqual({ character: false, card: false });
    expect(result.events.filter((event) => event.type === 'TURN_START')).toHaveLength(1);
  });

  it('功能牌操作 → 角色操作：顺序不限', () => {
    const state = battle();
    const played = applyAction(state, first(state, 'USE_CARD')).state;

    expect(played.currentPlayer).toBe('P1');
    expect(played.turnSlots).toEqual({ character: false, card: true });
    const remaining = getLegalActions(played);
    expect(remaining.some((action) => action.type === 'ATTACK')).toBe(true);
    expect(remaining.some((action) => action.type === 'USE_CARD')).toBe(false);
    expect(remaining.some((action) => action.type === 'DISCARD')).toBe(false);

    const attack = getLegalActions(played).find(
      (action) => action.type === 'ATTACK' && action.characterId === 'P1:Nana',
    );
    expect(attack).toBeDefined();
    const ended = applyAction(played, attack as Action).state;
    expect(ended.currentPlayer).toBe('P2');
  });

  it('同一槽位不能在同一个回合里重复用', () => {
    const state = battle();
    const moves = getLegalActions(state).filter((action) => action.type === 'MOVE');
    expect(moves.length).toBeGreaterThan(1);

    const moved = applyAction(state, moves[0] as Action).state;
    const second = moves[1] as Action;
    expect(validateAction(moved, second)).toMatchObject({ ok: false, code: 'SLOT_USED' });
    expect(() => applyAction(moved, second)).toThrow();
    expect(getLegalActions(moved).some((action) => action.type === 'MOVE')).toBe(false);
  });

  it('PASS 随时结束回合，放弃剩余槽位', () => {
    const state = battle();
    const ended = pass(state);
    expect(ended.currentPlayer).toBe('P2');
    expect(ended.turnIndex).toBe(state.turnIndex + 1);
    expect(ended.turnSlots).toEqual({ character: false, card: false });
  });

  it('DISCARD 占功能牌槽位，不影响角色操作', () => {
    const state = battle();
    const discarded = applyAction(state, first(state, 'DISCARD')).state;

    expect(discarded.currentPlayer).toBe('P1');
    expect(discarded.turnSlots).toEqual({ character: false, card: true });
    const remaining = getLegalActions(discarded);
    expect(remaining.some((action) => action.type === 'MOVE')).toBe(true);
    expect(remaining.some((action) => action.type === 'USE_CARD')).toBe(false);
    expect(applyAction(discarded, first(discarded, 'MOVE')).state.currentPlayer).toBe('P2');
  });

  it('CD 递减与抽牌只在回合开始发生一次，不随操作次数重复', () => {
    const state = battle();
    const skill = getLegalActions(state).find(
      (action) => action.type === 'USE_SKILL' && action.characterId === 'P1:Nana',
    );
    expect(skill).toBeDefined();
    const used = applyAction(state, skill as Action).state;
    expect(findCharacter(used, 'P1:Nana')?.skillCd).toBe(2);

    // 同一回合的第二个操作：不该再触发 CD 递减或抽牌
    const batch = applyAction(used, first(used, 'USE_CARD'));
    expect(batch.events.filter((event) => event.type === 'TURN_START')).toHaveLength(1);
    expect(batch.events.filter((event) => event.type === 'CARD_DRAWN').length).toBeLessThanOrEqual(
      1,
    );
    expect(findCharacter(batch.state, 'P1:Nana')?.skillCd).toBe(2);

    // P2 PASS 后回到 P1，才递减一次
    const back = pass(batch.state);
    expect(back.currentPlayer).toBe('P1');
    expect(findCharacter(back, 'P1:Nana')?.skillCd).toBe(1);
  });

  it('封路按回合到期，一个回合里的第二个操作不会让它提前解除', () => {
    const state = battle(['BlockRoad']);
    const block = getLegalActions(state).find(
      (action) =>
        action.type === 'USE_CARD' && action.choice.kind === 'EDGE' && action.choice.edge === '0-1',
    );
    expect(block).toBeDefined();
    let current = applyAction(state, block as Action).state;
    expect(blockedEdgeSet(current).has('0-1')).toBe(true);

    // 同一回合再用掉角色槽位，回合自动结束（turnIndex 0 → 1）
    current = applyAction(current, first(current, 'MOVE')).state;
    expect(current.turnIndex).toBe(1);
    expect(blockedEdgeSet(current).has('0-1')).toBe(true);

    // 之后 1 个回合仍有效，第 3 个回合开始解除（封路共 2 个回合）
    current = pass(current);
    expect(current.turnIndex).toBe(2);
    expect(blockedEdgeSet(current).has('0-1')).toBe(true);
    current = pass(current);
    expect(current.turnIndex).toBe(3);
    expect(blockedEdgeSet(current).has('0-1')).toBe(false);
  });

  it('槽位是公开信息，非行动方也能看到', () => {
    const state = battle();
    expect(getViewFor(state, 'P2').turnSlots).toEqual({ character: false, card: false });
    const used = applyAction(state, first(state, 'MOVE')).state;
    expect(getViewFor(used, 'P2').turnSlots).toEqual({ character: true, card: false });
  });
});
