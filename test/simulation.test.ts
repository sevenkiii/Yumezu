import { describe, expect, it } from 'vitest';

import { formatReport, runBatch } from './support/simulate';

const SMALL = { games: 4, seed: 'ci', maxTurns: 120 };

describe('Phase 5 统计工具', () => {
  it('小批量模拟可复现，报告结构与统计口径正确', () => {
    const first = runBatch(SMALL);
    const second = runBatch(SMALL);

    // 完全可复现：同一组参数得到完全相同的结果
    expect(first.summary).toEqual(second.summary);
    expect(first.characters).toEqual(second.characters);
    expect(first.cards).toEqual(second.cards);

    expect(first.games).toHaveLength(4);
    expect(first.summary.p1Wins + first.summary.p2Wins + first.summary.draws).toBe(4);
    expect(first.summary.endReasons.ANNIHILATION).toBe(first.summary.p1Wins + first.summary.p2Wins);
    expect(first.characters).toHaveLength(6);
    expect(first.cards).toHaveLength(11);

    // 每张牌打出次数不可能超过抽到次数
    for (const card of first.cards) {
      expect(card.played).toBeLessThanOrEqual(card.drawn);
      expect(card.discarded).toBeLessThanOrEqual(card.drawn);
      expect(card.playRate).toBeGreaterThanOrEqual(0);
      expect(card.playRate).toBeLessThanOrEqual(1);
    }
    for (const character of first.characters) {
      expect(character.appearances).toBeGreaterThan(0);
      expect(character.winRate).toBeGreaterThanOrEqual(0);
      expect(character.winRate).toBeLessThanOrEqual(1);
    }
    expect(first.summary.turns.mean).toBeGreaterThan(0);
    expect(first.summary.actions.mean).toBeGreaterThan(first.summary.turns.mean);
  }, 120000);

  it('每局的地图与出生点都满足 RULES.md 的约束', () => {
    const report = runBatch({ games: 3, seed: 'ci-map', maxTurns: 120 });
    for (const game of report.games) {
      expect(game.map.nodes).toBe(30);
      expect(game.map.edges).toBeGreaterThanOrEqual(40);
      expect(game.map.edges).toBeLessThanOrEqual(50);
      expect(game.map.spawnDistance).toBeGreaterThanOrEqual(6);
      expect(game.map.spawnDistance).toBeLessThanOrEqual(8);
      expect(game.roster.P1).toHaveLength(3);
      expect(game.roster.P2).toHaveLength(3);
    }
  }, 120000);

  it('不同 seed 得到不同结果', () => {
    const a = runBatch({ games: 3, seed: 'ci-a', maxTurns: 120 });
    const b = runBatch({ games: 3, seed: 'ci-b', maxTurns: 120 });
    expect(a.games[0]?.mapSeed).not.toBe(b.games[0]?.mapSeed);
    expect(a.summary).not.toEqual(b.summary);
  }, 120000);

  it('报告可以渲染为文本', () => {
    const report = runBatch({ games: 2, seed: 'ci-text', maxTurns: 120 });
    const text = formatReport(report);
    expect(text).toContain('夢図 Phase 5');
    expect(text).toContain('先手胜率');
    expect(text).toContain('Nana');
    expect(text).toContain('FirstAid');
  }, 120000);
});
