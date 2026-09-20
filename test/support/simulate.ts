/**
 * Phase 5 统计工具的核心库：批量自动对局 + 统计聚合。
 *
 * 关注点（对应 dev.md 的 Phase 5）：
 *  - 自动对局模拟：固定 seed 批量跑完整对局
 *  - 胜率统计：双方胜率、平局率、先手优势
 *  - 平均对局长度：行动数 / turnIndex 的均值、中位数、极值
 *  - 角色 / 功能牌使用率：出场、胜率、技能使用次数、抽到 / 打出比例
 *
 * 全部结果都由 seed 决定：同一组参数重复运行必然得到完全相同的报告。
 */

import { CARD_POOL } from '../../src/cards/CardPool';
import type {
  CardId,
  CharacterTypeId,
  EndReason,
  GameState,
  PlayerId,
} from '../../src/core/GameState';
import { CHARACTER_TYPE_IDS, PLAYER_IDS } from '../../src/core/GameState';
import { createGameFromSeed } from '../../src/core/GameEngine';
import { distance } from '../../src/map/Graph';
import { MapGenerationError } from '../../src/map/MapGenerator';
import { createRandomAgent, playGame } from './randomAgent';

export interface SimulationOptions {
  /** 模拟多少局。 */
  readonly games: number;
  /** 基准 seed：每局由它派生出 mapSeed / gameSeed / agentSeed。 */
  readonly seed: string;
  /** 每局的回合上限（必填，避免无限对局）。 */
  readonly maxTurns: number;
}

export const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
  games: 100,
  seed: 'sim',
  maxTurns: 300,
};

export interface MapSummary {
  readonly nodes: number;
  readonly edges: number;
  readonly spawnDistance: number;
  readonly generationAttempts: number;
}

export interface GameOutcome {
  readonly index: number;
  readonly mapSeed: string;
  readonly gameSeed: string;
  readonly winner: PlayerId | null;
  readonly reason: EndReason | null;
  readonly isDraw: boolean;
  readonly turns: number;
  readonly actions: number;
  readonly firstPlayer: PlayerId;
  readonly roster: Record<PlayerId, readonly CharacterTypeId[]>;
  readonly survivors: Record<PlayerId, number>;
  readonly skillUses: Record<CharacterTypeId, number>;
  readonly cardsDrawn: Record<CardId, number>;
  readonly cardsPlayed: Record<CardId, number>;
  readonly cardsDiscarded: Record<CardId, number>;
  readonly map: MapSummary;
}

export interface LengthStats {
  readonly mean: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly total: number;
}

export interface BatchSummary {
  readonly games: number;
  readonly p1Wins: number;
  readonly p2Wins: number;
  readonly draws: number;
  readonly p1WinRate: number;
  readonly p2WinRate: number;
  readonly drawRate: number;
  /** 先手方的胜率（分母只算分出胜负的局）。 */
  readonly firstPlayerWinRate: number;
  readonly decisiveGames: number;
  readonly endReasons: Record<EndReason, number>;
  readonly turns: LengthStats;
  readonly actions: LengthStats;
  readonly meanSurvivors: Record<PlayerId, number>;
}

export interface CharacterReport {
  readonly typeId: CharacterTypeId;
  /** 出场次数（一局里同一角色出现在双方阵容中会记 2 次）。 */
  readonly appearances: number;
  readonly wins: number;
  /** 胜率 = 胜利次数 / 分胜负局中的出场次数。 */
  readonly winRate: number;
  readonly skillUses: number;
  readonly skillUsesPerGame: number;
}

export interface CardReport {
  readonly cardId: CardId;
  readonly drawn: number;
  readonly played: number;
  readonly discarded: number;
  /** 使用率 = 打出次数 / 抽到次数。 */
  readonly playRate: number;
  /** 至少有抽到过一次的局数。 */
  readonly gamesDrawn: number;
}

export interface BatchReport {
  readonly options: SimulationOptions;
  readonly summary: BatchSummary;
  readonly characters: readonly CharacterReport[];
  readonly cards: readonly CardReport[];
  readonly games: readonly GameOutcome[];
}

export interface BatchHooks {
  readonly onGame?: (outcome: GameOutcome) => void;
}

function zeroCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const key of keys) counts[key] = 0;
  return counts;
}

/** 跑一局并收集统计。 */
export function simulateGame(index: number, options: SimulationOptions): GameOutcome {
  const base = options.seed + '-' + index;
  const mapSeed = base + '-map';
  const gameSeed = base + '-game';
  const agentSeed = base + '-agent';

  let state: GameState;
  let generationAttempts = 1;
  try {
    state = createGameFromSeed({ mapSeed, gameSeed, maxTurns: options.maxTurns });
  } catch (error) {
    if (!(error instanceof MapGenerationError)) throw error;
    // 极少数 seed 无法生成合格地图：换一个加盐的 mapSeed 再试一次（仍然完全确定）
    generationAttempts = 2;
    state = createGameFromSeed({
      mapSeed: mapSeed + '-alt',
      gameSeed,
      maxTurns: options.maxTurns,
    });
  }

  const openingHands: Record<PlayerId, CardId[]> = {
    P1: state.players.P1.hand.map((card) => card.cardId),
    P2: state.players.P2.hand.map((card) => card.cardId),
  };

  const log = playGame(state, createRandomAgent(agentSeed), options.maxTurns * 4 + 200);
  const finalState = log.state;

  const cardsDrawn = zeroCounts(CARD_POOL);
  const cardsPlayed = zeroCounts(CARD_POOL);
  const cardsDiscarded = zeroCounts(CARD_POOL);
  for (const player of PLAYER_IDS) {
    for (const cardId of openingHands[player]) cardsDrawn[cardId] += 1;
  }
  for (const record of finalState.history) {
    for (const event of record.events) {
      if (event.type === 'CARD_DRAWN') cardsDrawn[event.cardId] += 1;
      else if (event.type === 'CARD_PLAYED') cardsPlayed[event.cardId] += 1;
      else if (event.type === 'CARD_DISCARDED') cardsDiscarded[event.cardId] += 1;
    }
  }

  const skillUses = zeroCounts(CHARACTER_TYPE_IDS);
  for (const record of finalState.history) {
    const action = record.action;
    if (action.type !== 'USE_SKILL') continue;
    const character = finalState.characters.find((item) => item.id === action.characterId);
    if (character !== undefined) skillUses[character.typeId] += 1;
  }

  const result = finalState.result;
  const winner = result !== null && result.kind === 'WIN' ? result.winner : null;

  return {
    index,
    mapSeed,
    gameSeed,
    winner,
    reason: result === null ? null : result.reason,
    isDraw: result !== null && result.kind === 'DRAW',
    turns: finalState.turnIndex,
    actions: log.actionCount,
    firstPlayer: finalState.firstPlayer,
    roster: { P1: finalState.roster.P1.slice(), P2: finalState.roster.P2.slice() },
    survivors: {
      P1: finalState.characters.filter((c) => c.owner === 'P1' && c.alive).length,
      P2: finalState.characters.filter((c) => c.owner === 'P2' && c.alive).length,
    },
    skillUses,
    cardsDrawn,
    cardsPlayed,
    cardsDiscarded,
    map: {
      nodes: finalState.map.graph.vertices.length,
      edges: finalState.map.graph.edges.length,
      spawnDistance: distance(
        finalState.map.graph,
        finalState.spawn.P1.center,
        finalState.spawn.P2.center,
      ),
      generationAttempts,
    },
  };
}

/** 批量模拟并汇总。 */
export function runBatch(
  options: Partial<SimulationOptions> = {},
  hooks: BatchHooks = {},
): BatchReport {
  const resolved: SimulationOptions = { ...DEFAULT_SIMULATION_OPTIONS, ...options };
  const games: GameOutcome[] = [];
  for (let index = 0; index < resolved.games; index += 1) {
    const outcome = simulateGame(index, resolved);
    games.push(outcome);
    if (hooks.onGame !== undefined) hooks.onGame(outcome);
  }
  return { options: resolved, games, ...summarise(games) };
}

function summarise(games: readonly GameOutcome[]): {
  summary: BatchSummary;
  characters: CharacterReport[];
  cards: CardReport[];
} {
  const total = games.length;
  const p1Wins = games.filter((game) => game.winner === 'P1').length;
  const p2Wins = games.filter((game) => game.winner === 'P2').length;
  const draws = games.filter((game) => game.isDraw).length;
  const decisive = p1Wins + p2Wins;
  const firstPlayerWins = games.filter(
    (game) => game.winner !== null && game.winner === game.firstPlayer,
  ).length;

  const endReasons: Record<EndReason, number> = {
    ANNIHILATION: 0,
    MUTUAL_ANNIHILATION: 0,
    TURN_LIMIT: 0,
  };
  for (const game of games) {
    if (game.reason !== null) endReasons[game.reason] += 1;
  }

  const summary: BatchSummary = {
    games: total,
    p1Wins,
    p2Wins,
    draws,
    p1WinRate: ratio(p1Wins, total),
    p2WinRate: ratio(p2Wins, total),
    drawRate: ratio(draws, total),
    firstPlayerWinRate: ratio(firstPlayerWins, decisive),
    decisiveGames: decisive,
    endReasons,
    turns: lengthStats(games.map((game) => game.turns)),
    actions: lengthStats(games.map((game) => game.actions)),
    meanSurvivors: {
      P1: mean(games.map((game) => game.survivors.P1)),
      P2: mean(games.map((game) => game.survivors.P2)),
    },
  };

  return { summary, characters: characterReports(games), cards: cardReports(games) };
}

function characterReports(games: readonly GameOutcome[]): CharacterReport[] {
  const stats = new Map<
    CharacterTypeId,
    { appearances: number; wins: number; skillUses: number }
  >();
  for (const typeId of CHARACTER_TYPE_IDS) {
    stats.set(typeId, { appearances: 0, wins: 0, skillUses: 0 });
  }

  for (const game of games) {
    for (const player of PLAYER_IDS) {
      for (const typeId of game.roster[player]) {
        const entry = stats.get(typeId) as { appearances: number; wins: number; skillUses: number };
        entry.appearances += 1;
        if (game.winner === player) entry.wins += 1;
      }
    }
    for (const typeId of CHARACTER_TYPE_IDS) {
      const used = game.skillUses[typeId];
      if (used > 0) {
        const entry = stats.get(typeId) as { appearances: number; wins: number; skillUses: number };
        entry.skillUses += used;
      }
    }
  }

  const decisiveAppearances = new Map<CharacterTypeId, number>();
  for (const typeId of CHARACTER_TYPE_IDS) decisiveAppearances.set(typeId, 0);
  for (const game of games) {
    if (game.winner === null) continue;
    for (const player of PLAYER_IDS) {
      for (const typeId of game.roster[player]) {
        decisiveAppearances.set(typeId, (decisiveAppearances.get(typeId) ?? 0) + 1);
      }
    }
  }

  return CHARACTER_TYPE_IDS.map((typeId) => {
    const entry = stats.get(typeId) as { appearances: number; wins: number; skillUses: number };
    const decisiveCount = decisiveAppearances.get(typeId) ?? 0;
    return {
      typeId,
      appearances: entry.appearances,
      wins: entry.wins,
      winRate: ratio(entry.wins, decisiveCount),
      skillUses: entry.skillUses,
      skillUsesPerGame: ratio(entry.skillUses, Math.max(games.length, 1)),
    };
  });
}

function cardReports(games: readonly GameOutcome[]): CardReport[] {
  return CARD_POOL.map((cardId) => {
    let drawn = 0;
    let played = 0;
    let discarded = 0;
    let gamesDrawn = 0;
    for (const game of games) {
      drawn += game.cardsDrawn[cardId];
      played += game.cardsPlayed[cardId];
      discarded += game.cardsDiscarded[cardId];
      if (game.cardsDrawn[cardId] > 0) gamesDrawn += 1;
    }
    return {
      cardId,
      drawn,
      played,
      discarded,
      playRate: ratio(played, drawn),
      gamesDrawn,
    };
  });
}

function ratio(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return part / whole;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function lengthStats(values: readonly number[]): LengthStats {
  if (values.length === 0) return { mean: 0, median: 0, min: 0, max: 0, total: 0 };
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[middle] as number)
      : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
  return {
    mean: mean(values),
    median,
    min: sorted[0] as number,
    max: sorted[sorted.length - 1] as number,
    total: values.reduce((sum, value) => sum + value, 0),
  };
}

function percent(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

function pad(text: string | number, width: number): string {
  const value = String(text);
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function padLeft(text: string | number, width: number): string {
  const value = String(text);
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

/** 把报告渲染成便于阅读的文本（CLI 与测试共用）。 */
export function formatReport(report: BatchReport): string {
  const { options, summary, characters, cards } = report;
  const lines: string[] = [];

  lines.push('=== 夢図 Phase 5 模拟统计 ===');
  lines.push(
    '对局数 ' + summary.games + '   基准 seed: ' + options.seed + '   回合上限 ' + options.maxTurns,
  );
  lines.push('');
  lines.push('--- 胜负 ---');
  lines.push(
    'P1 ' +
      summary.p1Wins +
      ' (' +
      percent(summary.p1WinRate) +
      ')   P2 ' +
      summary.p2Wins +
      ' (' +
      percent(summary.p2WinRate) +
      ')   平局 ' +
      summary.draws +
      ' (' +
      percent(summary.drawRate) +
      ')',
  );
  lines.push(
    '先手胜率 ' +
      percent(summary.firstPlayerWinRate) +
      '（分母 = ' +
      summary.decisiveGames +
      ' 局分出胜负）',
  );
  lines.push(
    '结束方式：歼灭 ' +
      summary.endReasons.ANNIHILATION +
      '，同时全灭 ' +
      summary.endReasons.MUTUAL_ANNIHILATION +
      '，回合上限 ' +
      summary.endReasons.TURN_LIMIT,
  );
  lines.push('');
  lines.push('--- 对局长度 ---');
  lines.push(
    '行动数：平均 ' +
      summary.actions.mean.toFixed(1) +
      '，中位数 ' +
      summary.actions.median +
      '，最短 ' +
      summary.actions.min +
      '，最长 ' +
      summary.actions.max,
  );
  lines.push(
    '回合数：平均 ' +
      summary.turns.mean.toFixed(1) +
      '，中位数 ' +
      summary.turns.median +
      '（到达上限的局会计入 maxTurns）',
  );
  lines.push(
    '平均存活：P1 ' +
      summary.meanSurvivors.P1.toFixed(2) +
      '  P2 ' +
      summary.meanSurvivors.P2.toFixed(2),
  );
  lines.push('');
  lines.push('--- 角色 ---');
  lines.push('角色     出场  胜     胜率    技能/局');
  for (const character of characters) {
    lines.push(
      pad(character.typeId, 9) +
        padLeft(character.appearances, 4) +
        padLeft(character.wins, 6) +
        padLeft(percent(character.winRate), 8) +
        padLeft(character.skillUsesPerGame.toFixed(2), 9),
    );
  }
  lines.push('');
  lines.push('--- 功能牌 ---');
  lines.push('功能牌   抽到  打出  弃掉   使用率');
  for (const card of cards) {
    lines.push(
      pad(card.cardId, 9) +
        padLeft(card.drawn, 4) +
        padLeft(card.played, 6) +
        padLeft(card.discarded, 6) +
        padLeft(percent(card.playRate), 9),
    );
  }
  return lines.join('\n');
}
