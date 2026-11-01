import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import {
  applyAction,
  createGameFromSeed,
  getLegalActions,
  isFinished,
} from '../src/core/GameEngine';
import type { GameState, PlayerId } from '../src/core/GameState';
import { aliveCharactersOf, charactersOf, findCharacter } from '../src/core/GameState';
import { getViewFor } from '../src/core/View';
import { createRandomAgent, playGame } from './support/randomAgent';

function multiplayerGame(playerCount: 3 | 4, seed = 'multi'): GameState {
  return createGameFromSeed({
    mapSeed: seed + '-map',
    gameSeed: seed + '-game',
    playerCount,
    maxTurns: 300,
  });
}

function killPlayer(state: GameState, player: PlayerId): void {
  for (const character of charactersOf(state, player)) {
    character.hp = 0;
    character.alive = false;
  }
}

describe('多人混战核心', () => {
  it.each([
    [3, 36],
    [4, 42],
  ] as const)('%i 人局每人 3 名角色，地图扩到 %i 个节点', (playerCount, nodeCount) => {
    const state = multiplayerGame(playerCount, 'shape-' + playerCount);
    expect(state.seats).toEqual(['P1', 'P2', 'P3', 'P4'].slice(0, playerCount));
    expect(state.map.graph.vertices).toHaveLength(nodeCount);

    const regions: number[][] = [];
    for (const player of state.seats) {
      const own = charactersOf(state, player);
      expect(own).toHaveLength(3);
      expect(new Set(own.map((character) => character.position)).size).toBe(3);
      for (const character of own) expect(state.spawn[player].region).toContain(character.position);
      regions.push([...state.spawn[player].region]);
    }

    for (let i = 0; i < regions.length; i += 1) {
      for (let j = i + 1; j < regions.length; j += 1) {
        expect((regions[i] as number[]).some((id) => (regions[j] as number[]).includes(id))).toBe(
          false,
        );
      }
    }
  });

  it('严格按座位轮转，并跳过已经全灭的玩家', () => {
    let state = multiplayerGame(4, 'turn-order');
    state.currentPlayer = 'P1';

    state = applyAction(state, { type: 'PASS', player: 'P1' }).state;
    expect(state.currentPlayer).toBe('P2');
    state = applyAction(state, { type: 'PASS', player: 'P2' }).state;
    expect(state.currentPlayer).toBe('P3');
    state = applyAction(state, { type: 'PASS', player: 'P3' }).state;
    expect(state.currentPlayer).toBe('P4');
    state = applyAction(state, { type: 'PASS', player: 'P4' }).state;
    expect(state.currentPlayer).toBe('P1');

    killPlayer(state, 'P2');
    state = applyAction(state, { type: 'PASS', player: 'P1' }).state;
    expect(state.currentPlayer).toBe('P3');
  });

  it('手动部署模式按 P1 → P4 依次提交后同时公开', () => {
    let state = createGameFromSeed({
      mapSeed: 'manual-four-map',
      gameSeed: 'manual-four-game',
      playerCount: 4,
      deployment: 'manual',
    });
    for (const player of state.seats) {
      expect(state.phase).toBe('DEPLOY');
      expect(state.currentPlayer).toBe(player);
      state = applyAction(state, getLegalActions(state)[0] as Action).state;
    }
    expect(state.phase).toBe('BATTLE');
    expect(state.currentPlayer).toBe(state.firstPlayer);
    for (const player of state.seats) expect(state.deployment[player]).not.toBeNull();
  });

  it('普通攻击可以指向任意其他玩家，但不能攻击自己', () => {
    let state = multiplayerGame(4, 'attack-any');
    state.currentPlayer = 'P1';
    const attacker = charactersOf(state, 'P1')[0]!;
    const target = charactersOf(state, 'P3')[0]!;
    const from = state.map.graph.edges.find(
      (edge) => edge.a === attacker.position || edge.b === attacker.position,
    )!;
    const adjacent = from.a === attacker.position ? from.b : from.a;
    const occupant = state.characters.find(
      (character) =>
        character.alive && character.id !== target.id && character.position === adjacent,
    );
    if (occupant !== undefined) occupant.position = target.position;
    target.position = adjacent;

    const action: Action = {
      type: 'ATTACK',
      player: 'P1',
      characterId: attacker.id,
      targetId: target.id,
    };
    const legal = getLegalActions(state);
    expect(legal).toContainEqual(action);
    expect(
      legal.some(
        (candidate) =>
          candidate.type === 'ATTACK' && candidate.targetId.startsWith(attacker.owner + ':'),
      ),
    ).toBe(false);
    state = applyAction(state, action).state;
    expect(findCharacter(state, target.id)?.hp).toBeLessThan(target.maxHp);
  });

  it('最后一名存活玩家获胜', () => {
    let state = multiplayerGame(4, 'last-standing');
    killPlayer(state, 'P2');
    killPlayer(state, 'P3');
    const last = charactersOf(state, 'P4');
    for (const character of last.slice(0, -1)) {
      character.hp = 0;
      character.alive = false;
    }
    const survivor = last[last.length - 1]!;
    survivor.hp = 1;
    state.currentPlayer = 'P1';
    const attacker = charactersOf(state, 'P1')[0]!;
    const edge = state.map.graph.edges.find(
      (item) => item.a === attacker.position || item.b === attacker.position,
    )!;
    survivor.position = edge.a === attacker.position ? edge.b : edge.a;

    state = applyAction(state, {
      type: 'ATTACK',
      player: 'P1',
      characterId: attacker.id,
      targetId: survivor.id,
    }).state;
    expect(state.result).toEqual({ kind: 'WIN', winner: 'P1', reason: 'ANNIHILATION' });
  });

  it('每人只能看到自己的手牌，但能看到所有座位的手牌数量', () => {
    const state = multiplayerGame(4, 'privacy');
    for (const player of state.seats) {
      const view = getViewFor(state, player);
      expect(view.hand).toEqual(state.players[player].hand);
      for (const other of state.seats) {
        expect(view.handCounts[other]).toBe(state.players[other].hand.length);
        if (other !== player) {
          for (const card of state.players[other].hand) {
            expect(JSON.stringify(view.hand)).not.toContain(card.id);
          }
        }
      }
    }
  });

  it('随机决策器能跑完一整局四人混战', () => {
    const log = playGame(multiplayerGame(4, 'full-game'), createRandomAgent('four-agent'), 3000);
    expect(isFinished(log.state)).toBe(true);
    expect(log.state.result).not.toBeNull();
    if (log.state.result?.kind === 'WIN') {
      expect(aliveCharactersOf(log.state, log.state.result.winner).length).toBeGreaterThan(0);
    }
  });
});
