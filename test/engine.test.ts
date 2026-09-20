import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import {
  EngineError,
  applyAction,
  createGame,
  getLegalActions,
  isFinished,
  validateAction,
} from '../src/core/GameEngine';
import type { GameState } from '../src/core/GameState';
import { findCharacter } from '../src/core/GameState';
import { getViewFor } from '../src/core/View';
import { hashState } from '../src/core/hash';
import { PHASE1_MAP, PHASE1_SPAWN_CENTERS } from '../src/map/fixtures';
import { createBattleState } from './support/fixtures';

function newGame(gameSeed = 'seed-a', maxTurns: number | null = null): GameState {
  return createGame({
    mapSeed: 'map-a',
    gameSeed,
    graph: PHASE1_MAP,
    spawnCenters: { P1: PHASE1_SPAWN_CENTERS.P1, P2: PHASE1_SPAWN_CENTERS.P2 },
    maxTurns,
  });
}

function passOnce(state: GameState): GameState {
  const action = getLegalActions(state).find((item) => item.type === 'PASS') as Action;
  return applyAction(state, action).state;
}

describe('开局与确定性', () => {
  it('相同 seed 得到完全相同的状态', () => {
    expect(hashState(newGame('seed-a'))).toBe(hashState(newGame('seed-a')));
  });

  it('不同 gameSeed 得到不同的随机结果', () => {
    expect(hashState(newGame('seed-a'))).not.toBe(hashState(newGame('seed-b')));
  });

  it('双方各 3 名互不相同的角色、各 3 张手牌', () => {
    const state = newGame();
    expect(state.characters.filter((item) => item.owner === 'P1')).toHaveLength(3);
    expect(state.characters.filter((item) => item.owner === 'P2')).toHaveLength(3);
    expect(new Set(state.roster.P1).size).toBe(3);
    expect(state.players.P1.hand).toHaveLength(3);
    expect(state.phase).toBe('DEPLOY');
  });
});

describe('部署', () => {
  it('双方依次提交，完成后同时公开并开始先手回合', () => {
    let state = newGame();
    state = applyAction(state, getLegalActions(state)[0] as Action).state;
    expect(state.phase).toBe('DEPLOY');
    expect(state.currentPlayer).toBe('P2');
    expect(state.deployment.P1).not.toBeNull();

    state = applyAction(state, getLegalActions(state)[0] as Action).state;
    expect(state.phase).toBe('BATTLE');
    expect(state.currentPlayer).toBe(state.firstPlayer);
    expect(state.turnIndex).toBe(0);
    expect(state.players[state.firstPlayer].hand).toHaveLength(4);
  });

  it('部署必须落在自己的出生区域内', () => {
    const state = newGame();
    const own = state.characters.filter((item) => item.owner === 'P1');
    const result = validateAction(state, {
      type: 'DEPLOY',
      player: 'P1',
      assignments: [
        { characterId: own[0]!.id, vertex: 0 },
        { characterId: own[1]!.id, vertex: 20 },
        { characterId: own[2]!.id, vertex: 6 },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('DEPLOY_OUT_OF_REGION');
  });
});

describe('回合结构', () => {
  it('CD 在自己的回合开始时递减', () => {
    let state = createBattleState({
      p1: ['Nana', 'Lily', 'Melty'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Nana': 0,
        'P1:Lily': 13,
        'P1:Melty': 14,
        'P2:Nana': 2,
        'P2:Lily': 23,
        'P2:Melty': 28,
      },
      currentPlayer: 'P1',
    });
    const skill = getLegalActions(state).find(
      (action) => action.type === 'USE_SKILL' && action.characterId === 'P1:Nana',
    ) as Action;
    state = applyAction(state, skill).state;
    expect(findCharacter(state, 'P1:Nana')?.skillCd).toBe(2);

    state = passOnce(state);
    expect(findCharacter(state, 'P1:Nana')?.skillCd).toBe(1);

    state = passOnce(state);
    expect(findCharacter(state, 'P1:Nana')?.skillCd).toBe(1);

    state = passOnce(state);
    expect(findCharacter(state, 'P1:Nana')?.skillCd).toBe(0);
  });

  it('每次行动后 turnIndex 递增并交换行动权', () => {
    const state = createBattleState({ currentPlayer: 'P1' });
    const next = passOnce(state);
    expect(next.turnIndex).toBe(state.turnIndex + 1);
    expect(next.currentPlayer).toBe('P2');
  });

  it('手牌永远不超过 5 张', () => {
    let state = createBattleState({ currentPlayer: 'P1' });
    for (let i = 0; i < 8; i += 1) {
      state = passOnce(state);
      expect(state.players.P1.hand.length).toBeLessThanOrEqual(5);
      expect(state.players.P2.hand.length).toBeLessThanOrEqual(5);
    }
  });

  it('DISCARD 会弃掉一张牌', () => {
    const state = createBattleState({
      currentPlayer: 'P1',
      hands: { P1: ['FirstAid', 'Shield'] },
    });
    const discard = getLegalActions(state).find((action) => action.type === 'DISCARD') as Action;
    const next = applyAction(state, discard).state;
    expect(next.players.P1.hand).toHaveLength(1);
  });

  it('达到 maxTurns 时判为平局', () => {
    let state = newGame('seed-a', 4);
    while (state.phase === 'DEPLOY') {
      state = applyAction(state, getLegalActions(state)[0] as Action).state;
    }
    for (let i = 0; i < 4; i += 1) {
      if (!isFinished(state)) state = passOnce(state);
    }
    expect(isFinished(state)).toBe(true);
    expect(state.result).toMatchObject({ kind: 'DRAW', reason: 'TURN_LIMIT' });
  });
});

describe('胜负', () => {
  it('击败对方全部角色后结束，并拒绝后续行动', () => {
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
      currentPlayer: 'P1',
    });
    const last = findCharacter(state, 'P2:Nana');
    const otherA = findCharacter(state, 'P2:Lily');
    const otherB = findCharacter(state, 'P2:Melty');
    if (last === null || otherA === null || otherB === null) throw new Error('missing');
    last.hp = 2;
    otherA.alive = false;
    otherB.alive = false;

    const next = applyAction(state, {
      type: 'ATTACK',
      player: 'P1',
      characterId: 'P1:Nana',
      targetId: 'P2:Nana',
    }).state;

    expect(next.phase).toBe('FINISHED');
    expect(next.result).toMatchObject({ kind: 'WIN', winner: 'P1' });
    expect(getLegalActions(next)).toHaveLength(0);
    expect(validateAction(next, { type: 'PASS', player: 'P1' }).ok).toBe(false);
    expect(() => applyAction(next, { type: 'PASS', player: 'P1' })).toThrow(EngineError);
  });
});

describe('校验与合法行动', () => {
  it('不是当前玩家时拒绝行动', () => {
    const state = createBattleState({ currentPlayer: 'P1' });
    const result = validateAction(state, { type: 'PASS', player: 'P2' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_YOUR_TURN');
  });

  it('getLegalActions 产出的每个行动都能通过校验', () => {
    let state = newGame('seed-check', 30);
    for (let step = 0; step < 12 && !isFinished(state); step += 1) {
      const actions = getLegalActions(state);
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions.slice(0, 25)) {
        expect(validateAction(state, action).ok).toBe(true);
      }
      state = applyAction(state, actions[actions.length - 1] as Action).state;
    }
  });
});

describe('视图', () => {
  it('只隐藏对手手牌内容', () => {
    const state = createBattleState({ hands: { P1: ['FirstAid'], P2: ['Shield'] } });
    const view = getViewFor(state, 'P1');
    expect(view.hand).toHaveLength(1);
    expect(view.opponentHandCount).toBe(1);
    expect(view.opponentDeploymentSubmitted).toBe(true);
    // 对手的手牌实例（P2-C0）不应出现在视图里
    expect(JSON.stringify(view)).not.toContain('P2-C0');
  });
});
