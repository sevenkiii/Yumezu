import { describe, expect, it } from 'vitest';

import { getLegalActions, validateAction } from '../src/core/GameEngine';
import type { GameState } from '../src/core/GameState';
import { findCharacter } from '../src/core/GameState';
import { reachableDestinations } from '../src/rules/MovementRules';
import { createBattleState } from './support/fixtures';

function nana(state: GameState) {
  const character = findCharacter(state, 'P1:Nana');
  if (character === null) throw new Error('missing P1:Nana');
  return character;
}

function baseState(): GameState {
  return createBattleState({
    p1: ['Nana', 'Lily', 'Melty'],
    p2: ['Nana', 'Lily', 'Melty'],
    positions: {
      'P1:Nana': 0,
      'P1:Lily': 13,
      'P1:Melty': 14,
      'P2:Nana': 22,
      'P2:Lily': 23,
      'P2:Melty': 28,
    },
    currentPlayer: 'P1',
  });
}

describe('移动规则', () => {
  it('移动范围是上界：Nana(2) 从节点 0 可达 6 个节点', () => {
    const state = baseState();
    const destinations = reachableDestinations(state, nana(state));
    expect(destinations).toEqual([0, 1, 2, 6, 7, 12]);
  });

  it('不能穿过敌方、可以穿过友方，且不能停在任何已被占据的节点', () => {
    // 敌方挡在 1：过不去，也停不下
    const blocked = baseState();
    const enemy = findCharacter(blocked, 'P2:Nana');
    if (enemy === null) throw new Error('missing enemy');
    enemy.position = 1;
    const aroundEnemy = reachableDestinations(blocked, nana(blocked));
    expect(aroundEnemy).not.toContain(1);
    expect(aroundEnemy).not.toContain(2);
    expect(aroundEnemy).toEqual([0, 6, 7, 12]);
    expect(
      validateAction(blocked, { type: 'MOVE', player: 'P1', characterId: 'P1:Nana', to: 1 }).ok,
    ).toBe(false);

    // 友方挡在 1：可以穿过去（2 可达），但不能停在 1
    const throughAlly = baseState();
    const ally = findCharacter(throughAlly, 'P1:Lily');
    if (ally === null) throw new Error('missing ally');
    ally.position = 1;
    const aroundAlly = reachableDestinations(throughAlly, nana(throughAlly));
    expect(aroundAlly).not.toContain(1);
    expect(aroundAlly).toContain(2);
  });

  it('被冻结时不能移动', () => {
    const state = baseState();
    nana(state).statuses.Frozen = true;
    const result = validateAction(state, {
      type: 'MOVE',
      player: 'P1',
      characterId: 'P1:Nana',
      to: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FROZEN');

    const moves = getLegalActions(state).filter(
      (action) => action.type === 'MOVE' && action.characterId === 'P1:Nana',
    );
    expect(moves).toHaveLength(0);
  });

  it('移动 0 格是合法的（等价于放弃移动）', () => {
    const state = baseState();
    const result = validateAction(state, {
      type: 'MOVE',
      player: 'P1',
      characterId: 'P1:Nana',
      to: 0,
    });
    expect(result.ok).toBe(true);
  });
});
