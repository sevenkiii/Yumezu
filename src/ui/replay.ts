/**
 * 对局记录：一份可以完整重放这一局的 JSON。
 *
 * 只存**种子 + 行动序列**——引擎是确定性的（所有随机都走注入的 RNG，见 RULES.md §15），
 * 所以有这两样就能一帧一帧重现整局。用法：打完发现哪里怪，把这段 JSON 贴给协作者，
 * 对方载入后逐步回放即可，不需要截图或口述。
 */

import type { Action } from '../core/Action';

export interface GameRecord {
  readonly version: 1;
  readonly mapSeed: string;
  readonly gameSeed: string;
  readonly maxTurns: number | null;
  readonly actions: readonly Action[];
}

/** 序列化成可以直接复制粘贴的文本。 */
export function serializeRecord(record: GameRecord): string {
  return JSON.stringify(record, null, 2);
}

/**
 * 解析一段记录文本；不合法就返回 null（绝不抛错，输入来自用户粘贴）。
 * 只做形状校验：行动是否**合法**由引擎在回放时判断。
 */
export function parseRecord(text: string): GameRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== 1) return null;
  if (typeof candidate.mapSeed !== 'string' || typeof candidate.gameSeed !== 'string') return null;
  const maxTurns = candidate.maxTurns;
  if (maxTurns !== null && typeof maxTurns !== 'number') return null;
  if (!Array.isArray(candidate.actions)) return null;
  for (const action of candidate.actions) {
    if (typeof action !== 'object' || action === null) return null;
    if (typeof (action as { type?: unknown }).type !== 'string') return null;
  }
  return {
    version: 1,
    mapSeed: candidate.mapSeed,
    gameSeed: candidate.gameSeed,
    maxTurns: maxTurns === null ? null : (maxTurns as number),
    actions: candidate.actions as readonly Action[],
  };
}
