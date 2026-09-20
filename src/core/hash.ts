/**
 * 稳定序列化与状态哈希。
 *
 * 用途：黄金测试的快速断言、联机时的状态校验。
 * 要求：同一状态必须永远得到同一个字符串（对象键按字典序排序）。
 */

import type { GameState } from './GameState';

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = sortValue(source[key]);
    }
    return out;
  }
  return value;
}

/** 键序稳定的 JSON 字符串。 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/** FNV-1a 32 位哈希的十六进制表示。 */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** 对游戏状态取哈希，用于回放与黄金测试。 */
export function hashState(state: GameState): string {
  return hashString(stableStringify(state));
}
