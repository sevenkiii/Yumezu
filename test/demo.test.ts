/**
 * 验收 demo：在没有 UI 的情况下，用代码完整跑完一局 3v3。
 *
 * 现在走的是正式入口：mapSeed → 随机平面图 + 出生点 → gameSeed → 完整对局。
 * 单独运行：npx vitest run test/demo.test.ts
 */

import { describe, expect, it } from 'vitest';

import { createGameFromSeed, isFinished } from '../src/core/GameEngine';
import { createRandomAgent, playGame } from './support/randomAgent';

describe('demo：随机地图 + 完整对局', () => {
  it('能生成地图、跑完一局并输出胜者与统计', () => {
    const state = createGameFromSeed({
      mapSeed: 'demo-map',
      gameSeed: 'demo-game',
      maxTurns: 500,
    });

    const log = playGame(state, createRandomAgent('demo-agent'), 2000);
    expect(isFinished(log.state)).toBe(true);
    expect(log.state.result).not.toBeNull();

    const survivors = log.state.characters.filter((character) => character.alive);
    const lines = [
      '--- 夢図 demo（Phase 1 + Phase 2）---',
      '地图：节点 ' +
        log.state.map.graph.vertices.length +
        '，边 ' +
        log.state.map.graph.edges.length +
        '，出生中心 ' +
        log.state.spawn.P1.center +
        '/' +
        log.state.spawn.P2.center,
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
