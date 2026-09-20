/**
 * 确定性随机数：mulberry32 + 命名子流。见 RULES.md §15。
 *
 * 本模块保持纯函数式：不修改传入的流状态，而是返回新的状态。
 * 过程式生成代码（地图生成）可以用 createRngCursor 包出可变游标。
 */

export type RngStreamName = 'roster' | 'cards' | 'firstPlayer';

export const RNG_STREAM_NAMES: readonly RngStreamName[] = ['roster', 'cards', 'firstPlayer'];

/** 地图生成的子流：由 mapSeed 派生，与 gameSeed 完全独立。 */
export type MapStreamName = 'points' | 'edges' | 'spawn';

export const MAP_STREAM_NAMES: readonly MapStreamName[] = ['points', 'edges', 'spawn'];

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

/** 由 seed 与任意标签派生出一条独立的随机流。 */
export function createRngStreamNamed(seed: string, label: string): RngStreamState {
  return { state: hashSeed(seed + '::' + label), draws: 0 };
}

/** 由 seed 与子流名派生出一条独立的随机流。 */
export function createRngStream(seed: string, name: RngStreamName): RngStreamState {
  return createRngStreamNamed(seed, name);
}

/** 为 gameSeed 建立全部命名子流。 */
export function createRngStreams(seed: string): Record<RngStreamName, RngStreamState> {
  const streams = {} as Record<RngStreamName, RngStreamState>;
  for (const name of RNG_STREAM_NAMES) {
    streams[name] = createRngStream(seed, name);
  }
  return streams;
}

/** 为 mapSeed 建立地图生成的子流。 */
export function createMapRngStreams(mapSeed: string): Record<MapStreamName, RngStreamState> {
  const streams = {} as Record<MapStreamName, RngStreamState>;
  for (const name of MAP_STREAM_NAMES) {
    streams[name] = createRngStreamNamed(mapSeed, name);
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

/** 均匀浮点数 [0, 1)。 */
export function nextFloat(stream: RngStreamState): { value: number; next: RngStreamState } {
  const r = nextUint32(stream);
  return { value: r.value / 4294967296, next: r.next };
}

/** 均匀整数 [min, max]（闭区间）。 */
export function nextIntInRange(
  stream: RngStreamState,
  min: number,
  maxInclusive: number,
): { value: number; next: RngStreamState } {
  if (maxInclusive < min) throw new Error('nextIntInRange: 区间非法');
  const span = maxInclusive - min + 1;
  const r = nextUint32(stream);
  return { value: min + (r.value % span), next: r.next };
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

/**
 * 可变游标：给过程式生成代码用的便利包装。
 * 内部推进同一条流；需要时可 snapshot() 取回纯函数式的状态。
 */
export interface RngCursor {
  nextUint32(): number;
  nextFloat(): number;
  nextIndex(count: number): number;
  nextInt(minInclusive: number, maxInclusive: number): number;
  shuffled<T>(items: readonly T[]): T[];
  snapshot(): RngStreamState;
}

export function createRngCursor(initial: RngStreamState): RngCursor {
  let state = initial;
  return {
    nextUint32(): number {
      const r = nextUint32(state);
      state = r.next;
      return r.value;
    },
    nextFloat(): number {
      const r = nextUint32(state);
      state = r.next;
      return r.value / 4294967296;
    },
    nextIndex(count: number): number {
      const r = nextIndex(state, count);
      state = r.next;
      return r.value;
    },
    nextInt(minInclusive: number, maxInclusive: number): number {
      const r = nextIntInRange(state, minInclusive, maxInclusive);
      state = r.next;
      return r.value;
    },
    shuffled<T>(items: readonly T[]): T[] {
      const r = shuffled(state, items);
      state = r.next;
      return r.value;
    },
    snapshot(): RngStreamState {
      return state;
    },
  };
}
