/**
 * 【冻结】/【封技】的持续时间（RULES.md §10）。
 *
 * 旧规则：目标被选为行动角色的瞬间就消耗，几乎无效。
 * 新规则：按**目标自己的回合**计时，生效到该玩家下一次自己的回合结束，
 * 期间不因选中角色、做了什么操作而提前消失；只由 endTurn 统一移除。
 */

import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import { applyAction, createGameFromSeed, getLegalActions } from '../src/core/GameEngine';
import type { GameState } from '../src/core/GameState';
import { findCharacter } from '../src/core/GameState';
import { createBattleState } from './support/fixtures';

/** P1 行动中，P2 的两名角色带着两种状态，且没有手牌干扰。 */
function seeded(): GameState {
  const state = createBattleState({
    p1: ['Nana', 'Lily', 'Melty'],
    p2: ['Nana', 'Lily', 'Melty'],
    positions: {
      'P1:Nana': 0,
      'P1:Lily': 13,
      'P1:Melty': 14,
      'P2:Nana': 1,
      'P2:Lily': 23,
      'P2:Melty': 28,
    },
    hands: { P1: [], P2: [] },
    currentPlayer: 'P1',
  });
  const target = findCharacter(state, 'P2:Nana');
  if (target === null) throw new Error('测试局面缺少 P2:Nana');
  target.statuses.Frozen = true;
  target.statuses.SkillSealed = true;
  return state;
}

function pass(state: GameState, player: 'P1' | 'P2' | 'P3' | 'P4'): GameState {
  return applyAction(state, { type: 'PASS', player }).state;
}

function hasStatus(state: GameState, id: string, status: 'Frozen' | 'SkillSealed'): boolean {
  return findCharacter(state, id)?.statuses[status] === true;
}

describe('冻结 / 封技按一个回合消耗', () => {
  it('状态在目标的整个回合内持续生效，选中角色行动不再消耗它', () => {
    let state = pass(seeded(), 'P1'); // → P2 的回合
    expect(state.currentPlayer).toBe('P2');

    const legal = getLegalActions(state);
    // 冻结禁移动、封技禁专属技能，但普攻仍然合法
    expect(legal.some((action) => action.type === 'MOVE' && action.characterId === 'P2:Nana')).toBe(
      false,
    );
    expect(
      legal.some((action) => action.type === 'USE_SKILL' && action.characterId === 'P2:Nana'),
    ).toBe(false);
    expect(
      legal.some((action) => action.type === 'ATTACK' && action.characterId === 'P2:Nana'),
    ).toBe(true);

    // 让另一名角色移动（占用角色槽位），状态不应被消耗
    const move = legal.find(
      (action) => action.type === 'MOVE' && action.characterId !== 'P2:Nana',
    ) as Action;
    expect(move).toBeDefined();
    state = applyAction(state, move).state;
    expect(state.currentPlayer).toBe('P2');
    expect(hasStatus(state, 'P2:Nana', 'Frozen')).toBe(true);
    expect(hasStatus(state, 'P2:Nana', 'SkillSealed')).toBe(true);
  });

  it('目标回合结束时统一移除，并产出 STATUS_REMOVED 事件', () => {
    const state = pass(seeded(), 'P1'); // → P2 的回合
    const batch = applyAction(state, { type: 'PASS', player: 'P2' });

    expect(batch.state.currentPlayer).toBe('P1');
    expect(hasStatus(batch.state, 'P2:Nana', 'Frozen')).toBe(false);
    expect(hasStatus(batch.state, 'P2:Nana', 'SkillSealed')).toBe(false);
    const removed = batch.events.filter((event) => event.type === 'STATUS_REMOVED');
    expect(removed).toHaveLength(2);
    expect(removed.map((event) => (event.type === 'STATUS_REMOVED' ? event.status : null))).toEqual(
      expect.arrayContaining(['Frozen', 'SkillSealed']),
    );
  });

  it('施加当回合（敌方回合结束）不会把状态清掉', () => {
    const state = seeded();
    // P1 是施加者的回合，结束回合只清理 P1 自己角色的状态
    const next = pass(state, 'P1');
    expect(hasStatus(next, 'P2:Nana', 'Frozen')).toBe(true);
    expect(hasStatus(next, 'P2:Nana', 'SkillSealed')).toBe(true);
  });

  it('多人局里跨过其它座位回合也不消耗，直到目标自己的回合结束', () => {
    const state = createGameFromSeed({
      mapSeed: 'status-4p-map',
      gameSeed: 'status-4p-game',
      playerCount: 4,
    });
    state.currentPlayer = 'P1';
    const target = state.characters.find((character) => character.owner === 'P4');
    if (target === undefined) throw new Error('四人局缺少 P4 角色');
    target.statuses.Frozen = true;
    target.statuses.SkillSealed = true;
    const id = target.id;

    let current = pass(state, 'P1'); // → P2
    expect(current.currentPlayer).toBe('P2');
    current = pass(current, 'P2'); // → P3
    current = pass(current, 'P3'); // → P4
    expect(current.currentPlayer).toBe('P4');
    expect(hasStatus(current, id, 'Frozen')).toBe(true);
    expect(hasStatus(current, id, 'SkillSealed')).toBe(true);

    current = pass(current, 'P4'); // P4 回合结束 → 移除
    expect(hasStatus(current, id, 'Frozen')).toBe(false);
    expect(hasStatus(current, id, 'SkillSealed')).toBe(false);
  });
});
