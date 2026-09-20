/**
 * 确定性随机数：mulberry32 + 命名子流。见 RULES.md「随机数」。
 *
 * 本模块是纯函数式的：不修改传入的流状态，而是返回新的状态。
 */

export type RngStreamName = 'roster' | 'cards' | 'firstPlayer';

export const RNG_STREAM_NAMES: readonly RngStreamName[] = ['roster', 'cards', 'firstPlayer'];

/** 单条随机流的可序列化状态。 */
export interface RngStreamState {
  /** mulberry32 的内部状态（uint32）。 */
  readonly state: number;
  /** 已抽取次数，仅用于调试与回放展示。 */
  readonly draws: number;
}

/** FNV-1a 32 位哈希：把任意字符串映射为 uint32。 */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 由 seed 与子流名派生出一条独立的随机流。 */
export function createRngStream(seed: string, name: RngStreamName): RngStreamState {
  return { state: hashSeed(seed + '::' + name), draws: 0 };
}

/** 为 gameSeed 建立全部命名子流。 */
export function createRngStreams(seed: string): Record<RngStreamName, RngStreamState> {
  const streams = {} as Record<RngStreamName, RngStreamState>;
  for (const name of RNG_STREAM_NAMES) {
    streams[name] = createRngStream(seed, name);
  }
  return streams;
}

/** 取出下一个 uint32，并返回新的流状态。 */
export function nextUint32(stream: RngStreamState): { value: number; next: RngStreamState } {
  const a = (stream.state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = (t ^ (t >>> 14)) >>> 0;
  return { value, next: { state: a, draws: stream.draws + 1 } };
}

/** 均匀取 [0, count) 的下标。count 必须是正整数。 */
export function nextIndex(
  stream: RngStreamState,
  count: number,
): { value: number; next: RngStreamState } {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('nextIndex: count 必须是正整数');
  }
  const r = nextUint32(stream);
  return { value: r.value % count, next: r.next };
}

/** Fisher-Yates 洗牌，返回新数组，不修改输入。 */
export function shuffled<T>(
  stream: RngStreamState,
  items: readonly T[],
): { value: T[]; next: RngStreamState } {
  const out = items.slice();
  let s = stream;
  for (let i = out.length - 1; i > 0; i -= 1) {
    const r = nextIndex(s, i + 1);
    s = r.next;
    const j = r.value;
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return { value: out, next: s };
}
