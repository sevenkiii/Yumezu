import { describe, expect, it } from 'vitest';

import { createGame, isFinished } from '../src/core/GameEngine';
import type { GameState } from '../src/core/GameState';
import { hashState } from '../src/core/hash';
import { PHASE1_MAP, PHASE1_SPAWN_CENTERS } from '../src/map/fixtures';
import { createRandomAgent, playGame } from './support/randomAgent';

function newGame(gameSeed: string, maxTurns: number | null = null): GameState {
  return createGame({
    mapSeed: 'golden-map',
    gameSeed,
    graph: PHASE1_MAP,
    spawnCenters: { P1: PHASE1_SPAWN_CENTERS.P1, P2: PHASE1_SPAWN_CENTERS.P2 },
    maxTurns,
  });
}

describe('固定 seed 的黄金测试', () => {
  it('同一 seed 跑出的整局完全一致', () => {
    const first = playGame(newGame('golden-1', 300), createRandomAgent('agent-1'));
    const second = playGame(newGame('golden-1', 300), createRandomAgent('agent-1'));
    expect(hashState(first.state)).toBe(hashState(second.state));
    expect(first.actionCount).toBe(second.actionCount);
    expect(first.decisions).toEqual(second.decisions);
  });

  it('同一地图、不同 gameSeed 会产生不同的对局', () => {
    const a = playGame(newGame('golden-a', 300), createRandomAgent('agent-1'));
    const b = playGame(newGame('golden-b', 300), createRandomAgent('agent-1'));
    expect(hashState(a.state)).not.toBe(hashState(b.state));
  });

  it('随机对局总能在回合上限内结束（不出现死循环）', () => {
    for (const seed of ['golden-1', 'golden-2', 'golden-3']) {
      const log = playGame(newGame(seed, 400), createRandomAgent('agent-' + seed));
      expect(isFinished(log.state)).toBe(true);
      // 双方部署占 2 次行动且不推进 turnIndex，因此上界是 maxTurns + 2
      expect(log.actionCount).toBeLessThanOrEqual(402);
    }
  });
});
