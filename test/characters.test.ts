import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import { applyAction, getLegalActions } from '../src/core/GameEngine';
import type { GameState } from '../src/core/GameState';
import { findCharacter } from '../src/core/GameState';
import { createBattleState } from './support/fixtures';

function skillActions(state: GameState, characterId: string): Action[] {
  return getLegalActions(state).filter(
    (action) => action.type === 'USE_SKILL' && action.characterId === characterId,
  );
}

function useSkill(state: GameState, action: Action): GameState {
  return applyAction(state, action).state;
}

function hp(state: GameState, id: string): number {
  const character = findCharacter(state, id);
  if (character === null) throw new Error('missing ' + id);
  return character.hp;
}

describe('Nana「地球仪」', () => {
  it('只能选择距离 2 以内的敌人，造成 4 点伤害并进入 CD 2', () => {
    const state = createBattleState({
      p1: ['Nana', 'Lily', 'Melty'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Nana': 0,
        'P1:Lily': 13,
        'P1:Melty': 14,
        'P2:Nana': 2,
        'P2:Lily': 3,
        'P2:Melty': 28,
      },
      currentPlayer: 'P1',
    });
    const actions = skillActions(state, 'P1:Nana');
    expect(actions).toHaveLength(1);
    const next = useSkill(state, actions[0] as Action);
    expect(hp(next, 'P2:Nana')).toBe(6);
    expect(hp(next, 'P2:Lily')).toBe(10);
    expect(findCharacter(next, 'P1:Nana')?.skillCd).toBe(2);
  });

  it('范围内没有敌人时技能不可用', () => {
    const state = createBattleState({
      p1: ['Nana', 'Lily', 'Melty'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Nana': 0,
        'P1:Lily': 13,
        'P1:Melty': 14,
        'P2:Nana': 29,
        'P2:Lily': 28,
        'P2:Melty': 27,
      },
      currentPlayer: 'P1',
    });
    expect(skillActions(state, 'P1:Nana')).toHaveLength(0);
  });
});

describe('Lily「换位」', () => {
  it('可以交换距离 3 以内的任意其他角色，并排除自身', () => {
    const state = createBattleState({
      p1: ['Lily', 'Nana', 'Melty'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Lily': 0,
        'P1:Nana': 13,
        'P1:Melty': 14,
        'P2:Nana': 3,
        'P2:Lily': 28,
        'P2:Melty': 29,
      },
      currentPlayer: 'P1',
    });
    const actions = skillActions(state, 'P1:Lily');
    const targets = actions.map((action) =>
      action.type === 'USE_SKILL' && action.choice.kind === 'SINGLE_TARGET'
        ? action.choice.targetId
        : '',
    );
    expect(targets).toContain('P2:Nana');
    expect(targets).toContain('P1:Nana');
    expect(targets).not.toContain('P1:Lily');

    const swap = actions.find(
      (action) =>
        action.type === 'USE_SKILL' &&
        action.choice.kind === 'SINGLE_TARGET' &&
        action.choice.targetId === 'P2:Nana',
    ) as Action;
    const next = useSkill(state, swap);
    expect(findCharacter(next, 'P1:Lily')?.position).toBe(3);
    expect(findCharacter(next, 'P2:Nana')?.position).toBe(0);
  });
});

describe('Melty「Melty Land」', () => {
  it('友方回血 2、敌方受伤 2，且不影响自己', () => {
    const state = createBattleState({
      p1: ['Melty', 'Nana', 'Lily'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Melty': 7,
        'P1:Nana': 8,
        'P1:Lily': 14,
        'P2:Nana': 1,
        'P2:Lily': 12,
        'P2:Melty': 29,
      },
      currentPlayer: 'P1',
    });
    const ally = findCharacter(state, 'P1:Nana');
    if (ally === null) throw new Error('missing');
    ally.hp = 5;

    const actions = skillActions(state, 'P1:Melty');
    expect(actions).toHaveLength(1);
    const next = useSkill(state, actions[0] as Action);
    expect(hp(next, 'P1:Nana')).toBe(7);
    expect(hp(next, 'P2:Nana')).toBe(8);
    expect(hp(next, 'P2:Lily')).toBe(10);
    expect(hp(next, 'P1:Melty')).toBe(10);
  });
});

describe('Mikage「影返」', () => {
  it('在当前位置留下影标记', () => {
    const state = createBattleState({
      p1: ['Mikage', 'Nana', 'Lily'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Mikage': 8,
        'P1:Nana': 13,
        'P1:Lily': 14,
        'P2:Nana': 22,
        'P2:Lily': 23,
        'P2:Melty': 28,
      },
      currentPlayer: 'P1',
    });
    const actions = skillActions(state, 'P1:Mikage');
    expect(actions).toHaveLength(1);
    const next = useSkill(state, actions[0] as Action);
    expect(findCharacter(next, 'P1:Mikage')?.shadowMark).toBe(8);
  });
});

describe('Spica「星奔」', () => {
  it('移动后对所有距离 1 的敌人各造成 1 点伤害', () => {
    const state = createBattleState({
      p1: ['Spica', 'Nana', 'Lily'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Spica': 7,
        'P1:Nana': 13,
        'P1:Lily': 14,
        'P2:Nana': 9,
        'P2:Lily': 14,
        'P2:Melty': 29,
      },
      currentPlayer: 'P1',
    });
    findCharacter(state, 'P1:Lily')!.position = 24;
    findCharacter(state, 'P2:Lily')!.position = 14;

    const actions = skillActions(state, 'P1:Spica');
    const jump = actions.find(
      (action) =>
        action.type === 'USE_SKILL' &&
        action.choice.kind === 'MOVE_THEN_STRIKE' &&
        action.choice.to === 8,
    ) as Action;
    expect(jump).toBeDefined();
    const next = useSkill(state, jump);
    expect(findCharacter(next, 'P1:Spica')?.position).toBe(8);
    expect(hp(next, 'P2:Nana')).toBe(9);
    expect(hp(next, 'P2:Lily')).toBe(9);
  });

  it('被冻结时不能使用（冻结禁止移动）', () => {
    const state = createBattleState({
      p1: ['Spica', 'Nana', 'Lily'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Spica': 7,
        'P1:Nana': 13,
        'P1:Lily': 14,
        'P2:Nana': 22,
        'P2:Lily': 23,
        'P2:Melty': 28,
      },
      currentPlayer: 'P1',
    });
    findCharacter(state, 'P1:Spica')!.statuses.Frozen = true;
    expect(skillActions(state, 'P1:Spica')).toHaveLength(0);
  });
});

describe('Urara「冻结」', () => {
  it('冻结距离 1 以内的所有敌人', () => {
    const state = createBattleState({
      p1: ['Urara', 'Nana', 'Lily'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Urara': 7,
        'P1:Nana': 13,
        'P1:Lily': 14,
        'P2:Nana': 8,
        'P2:Lily': 12,
        'P2:Melty': 29,
      },
      currentPlayer: 'P1',
    });
    const actions = skillActions(state, 'P1:Urara');
    expect(actions).toHaveLength(1);
    const next = useSkill(state, actions[0] as Action);
    expect(findCharacter(next, 'P2:Nana')?.statuses.Frozen).toBe(true);
    expect(findCharacter(next, 'P2:Lily')?.statuses.Frozen).toBe(false);
  });
});
