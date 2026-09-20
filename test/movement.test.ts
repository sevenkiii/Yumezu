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

  it('不能穿过敌方角色', () => {
    const state = baseState();
    const enemy = findCharacter(state, 'P2:Nana');
    if (enemy === null) throw new Error('missing enemy');
    enemy.position = 1;
    const destinations = reachableDestinations(state, nana(state));
    expect(destinations).not.toContain(1);
    expect(destinations).not.toContain(2);
    expect(destinations).toContain(7);
    expect(destinations).toEqual([0, 6, 7, 12]);
  });

  it('可以穿过友方角色，但不能停在友方所在节点', () => {
    const state = baseState();
    const ally = findCharacter(state, 'P1:Lily');
    if (ally === null) throw new Error('missing ally');
    ally.position = 1;
    const destinations = reachableDestinations(state, nana(state));
    expect(destinations).not.toContain(1);
    expect(destinations).toContain(2);
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

  it('不能移动到其他角色所在的节点', () => {
    const state = baseState();
    const result = validateAction(state, {
      type: 'MOVE',
      player: 'P1',
      characterId: 'P1:Nana',
      to: 13,
    });
    expect(result.ok).toBe(false);
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
