/**
 * Phase 5 统计工具 CLI。
 *
 * 用法：
 *   npm run simulate -- --games 200 --seed base --maxTurns 300
 *   npm run simulate -- --games 50 --json          # 输出 JSON（不含逐局明细）
 *   npm run simulate -- --games 50 --json-full     # 输出 JSON（含逐局明细）
 *
 * 参数：--games / --seed / --maxTurns / --json / --json-full
 */

import {
  DEFAULT_SIMULATION_OPTIONS,
  formatReport,
  runBatch,
  type BatchReport,
} from './support/simulate';

interface CliOptions {
  readonly games: number;
  readonly seed: string;
  readonly maxTurns: number;
  readonly json: boolean;
  readonly jsonFull: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let games = DEFAULT_SIMULATION_OPTIONS.games;
  let seed = DEFAULT_SIMULATION_OPTIONS.seed;
  let maxTurns = DEFAULT_SIMULATION_OPTIONS.maxTurns;
  let json = false;
  let jsonFull = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (!arg.startsWith('--')) continue;
    const body = arg.slice(2);
    const equals = body.indexOf('=');
    const key = equals >= 0 ? body.slice(0, equals) : body;
    const next = argv[index + 1];
    const value =
      equals >= 0
        ? body.slice(equals + 1)
        : next !== undefined && !next.startsWith('--')
          ? ((index += 1), next)
          : 'true';

    if (key === 'games') games = Number.parseInt(value, 10);
    else if (key === 'seed') seed = value;
    else if (key === 'maxTurns') maxTurns = Number.parseInt(value, 10);
    else if (key === 'json') json = true;
    else if (key === 'json-full') jsonFull = true;
    else if (key === 'help') {
      process.stdout.write(
        '用法：npm run simulate -- [--games N] [--seed S] [--maxTurns N] [--json|--json-full]\n',
      );
      process.exit(0);
    }
  }

  if (!Number.isInteger(games) || games <= 0) games = DEFAULT_SIMULATION_OPTIONS.games;
  if (!Number.isInteger(maxTurns) || maxTurns <= 0) maxTurns = DEFAULT_SIMULATION_OPTIONS.maxTurns;
  return { games, seed, maxTurns, json, jsonFull };
}

function toJson(report: BatchReport, includeGames: boolean): string {
  const payload = includeGames
    ? report
    : {
        options: report.options,
        summary: report.summary,
        characters: report.characters,
        cards: report.cards,
      };
  return JSON.stringify(payload, null, 2);
}

export async function main(argv: readonly string[]): Promise<void> {
  const options = parseArgs(argv);
  const startedAt = Date.now();
  // 只在交互终端显示进度，避免污染被重定向的输出
  const showProgress = process.stderr.isTTY === true && !options.json && !options.jsonFull;
  const step = Math.max(1, Math.floor(options.games / 20));

  const report = runBatch(
    { games: options.games, seed: options.seed, maxTurns: options.maxTurns },
    {
      onGame: (outcome) => {
        if (!showProgress) return;
        const done = outcome.index + 1;
        if (done % step === 0 || done === options.games) {
          process.stderr.write('\r模拟进度 ' + done + '/' + options.games + ' 局…');
        }
      },
    },
  );
  if (showProgress) process.stderr.write('\r' + ' '.repeat(40) + '\r');

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (options.json || options.jsonFull) {
    process.stdout.write(toJson(report, options.jsonFull) + '\n');
    return;
  }
  process.stdout.write(formatReport(report) + '\n');
  process.stdout.write('耗时 ' + elapsed + ' 秒（' + options.games + ' 局）\n');
}
