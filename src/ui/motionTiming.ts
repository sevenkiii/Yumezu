/**
 * 表现层的动画时长与节奏（纯常量 + 纯函数，方便单测与复用）。
 *
 * 两条节奏：
 *  - **走位**：一个节点一跳，每跳末尾留一小段"站定"，跳与跳之间有节奏；
 *  - **撞击**：先微微后仰蓄力，冲过去撞上并顶住一小会儿，再退回来。
 *
 * 同一批事件里如果既走位又打人（星奔这类），撞击要**等走位走完**再发生，
 * 不然会出现"还没走到就把人撞了"。
 */

import type { CharacterId } from '../core/GameState';
import type { TokenLunge, TokenTrail } from './tokenTrail';

/** 每一跳的时长（毫秒）。 */
export const HOP_MS = 250;
/** 每一跳末尾"站定"的比例，让逐跳的节奏看得出来。 */
export const HOP_SETTLE = 0.34;

/** 一批事件里有多个角色同时动时的错开量。 */
export const STAGGER_MS = 80;

/** 一次"撞过去"的总时长（毫秒）。 */
export const LUNGE_MS = 520;
/** 撞之前先微微后仰蓄力：时间点与后仰距离。 */
export const LUNGE_ANTICIPATE = 0.12;
export const LUNGE_BACK = 10;
/** 撞到目标 / 顶住目标的时间点（占总时长的比例）。 */
export const LUNGE_IMPACT = 0.3;
export const LUNGE_HOLD = 0.55;
/** 前冲距离占两者间距的比例；再远也不会超过 LUNGE_MAX。 */
export const LUNGE_APPROACH = 0.58;
export const LUNGE_MAX = 96;
/** 撞上瞬间的放大倍数（像是"顶"上去）。 */
export const LUNGE_SCALE = 1.16;
/** 目标被顶开的距离（棋盘单位）。 */
export const KNOCK_DISTANCE = 14;

/**
 * 一批事件的表现要留多久才够：最长的一段是"走完再撞"（4 跳）+ 撞击 + 命中环。
 * App 用它决定多久之后清空 fxEvents。
 */
export const MOTION_WINDOW_MS = 4 * HOP_MS + LUNGE_MS + 400;

/** 一次走位需要多久（毫秒）。 */
export function trailDurationMs(trail: TokenTrail): number {
  return (trail.points.length - 1) * HOP_MS;
}

/** 角色 id → 这一批里它走位要花的时间。 */
export function trailDurationsOf(trails: readonly TokenTrail[]): Map<CharacterId, number> {
  return new Map(trails.map((trail) => [trail.characterId, trailDurationMs(trail)]));
}

/** 这次撞击什么时候开始：等出手方走完，再加上同批多个撞击之间的错开。 */
export function lungeDelayMs(
  lunge: TokenLunge,
  trailDurations: ReadonlyMap<CharacterId, number>,
  index: number,
): number {
  return (trailDurations.get(lunge.characterId) ?? 0) + index * STAGGER_MS;
}
