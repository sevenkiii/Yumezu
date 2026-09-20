/**
 * Phase 1 验收 demo：在没有 UI 的情况下，用代码完整跑完一局 3v3。
 *
 * 单独运行：npx vitest run test/demo.test.ts
 */

import { describe, expect, it } from 'vitest';

import { createGame, isFinished } from '../src/core/GameEngine';
import { PHASE1_MAP, PHASE1_SPAWN_CENTERS } from '../src/map/fixtures';
import { createRandomAgent, playGame } from './support/randomAgent';

describe('demo：完整对局', () => {
  it('能跑完一局并输出胜者与统计', () => {
    const state = createGame({
      mapSeed: 'demo-map',
      gameSeed: 'demo-game',
      graph: PHASE1_MAP,
      spawnCenters: { P1: PHASE1_SPAWN_CENTERS.P1, P2: PHASE1_SPAWN_CENTERS.P2 },
      maxTurns: 500,
    });

    const log = playGame(state, createRandomAgent('demo-agent'), 2000);
    expect(isFinished(log.state)).toBe(true);
    expect(log.state.result).not.toBeNull();

    const survivors = log.state.characters.filter((character) => character.alive);
    const lines = [
      '--- Phase 1 demo ---',
      '阵容：P1=' + log.state.roster.P1.join('/') + '  P2=' + log.state.roster.P2.join('/'),
      '先手：' + log.state.firstPlayer,
      '结果：' + JSON.stringify(log.state.result),
      '总行动数：' + log.actionCount + '，turnIndex=' + log.state.turnIndex,
      '存活：' + survivors.map((character) => character.id + '(' + character.hp + ')').join(', '),
      '最后 5 步：' + log.decisions.slice(-5).join(' | '),
    ];
    console.warn(lines.join('\n'));
  });
});
