/**
 * 让地图上的角色 token "一个节点一个节点"地走过去，而不是瞬移。
 *
 * 为什么用 Web Animations API：
 *  - 引擎结算完时，token 的静态坐标已经是终点；动画只是给它叠一个**临时位移**，
 *    所以不必把"正在移动到的位置"塞进 React 状态，也不会和引擎状态打架；
 *  - 每次位移的跳数不同，关键帧只能按轨迹现算。
 *
 * 动画结束不留下残留 transform（fill: 'none'）——终点就等于 token 的静态坐标。
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import type { CharacterId } from '../core/GameState';
import type { TokenTrail, TrailPoint } from './tokenTrail';

/** 每一跳的时长（毫秒）。 */
const HOP_MS = 170;
/** 每一跳末尾"站定"的比例，让逐跳的节奏看得出来。 */
const HOP_SETTLE = 0.3;
/** 跳起时放大一点，像是离开了桌面；设为 0 就退化成纯平移。 */
const HOP_LIFT = 0.14;
/** 同一批事件里有多个角色同时动时的错开量。 */
const STAGGER_MS = 70;

export interface TokenMotion {
  /** 交给 <g className="token"> 的 ref 回调。 */
  readonly setTokenRef: (characterId: CharacterId, element: SVGGElement | null) => void;
}

/** SSR（渲染冒烟测试）里没有 DOM，退回 useEffect 以免 React 报警。 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useTokenMotion(trails: readonly TokenTrail[]): TokenMotion {
  const elements = useRef(new Map<CharacterId, SVGGElement>());
  const running = useRef(new Map<CharacterId, Animation>());

  const setTokenRef = useCallback((characterId: CharacterId, element: SVGGElement | null): void => {
    if (element === null) elements.current.delete(characterId);
    else elements.current.set(characterId, element);
  }, []);

  // 必须在绘制这一帧之前启动动画，否则会先闪一下"已经站在终点"的画面。
  useIsomorphicLayoutEffect(() => {
    if (trails.length === 0) return;
    if (prefersReducedMotion()) return;
    trails.forEach((trail, index) => {
      const element = elements.current.get(trail.characterId);
      if (element === undefined || !supportsAnimate(element)) return;
      running.current.get(trail.characterId)?.cancel();
      running.current.set(
        trail.characterId,
        element.animate(keyframesOf(trail), {
          duration: (trail.points.length - 1) * HOP_MS,
          delay: index * STAGGER_MS,
          easing: 'ease-in-out',
          fill: 'none',
        }),
      );
    });
  }, [trails]);

  useEffect(() => {
    const animations = running.current;
    return () => {
      for (const animation of animations.values()) animation.cancel();
      animations.clear();
    };
  }, []);

  return { setTokenRef };
}

/**
 * 关键帧：相对终点做位移，所以静态坐标（终点）不用改。
 * 每一跳的末尾留一小段"站定"，跳与跳之间就有节奏了。
 */
function keyframesOf(trail: TokenTrail): Keyframe[] {
  const { points } = trail;
  const end = points[points.length - 1] as TrailPoint;
  const segments = points.length - 1;

  const offsetOf = (point: TrailPoint, lift = 1): string => {
    const translate = `translate(${(point.x - end.x).toFixed(2)}px, ${(point.y - end.y).toFixed(2)}px)`;
    return lift === 1 ? translate : `${translate} scale(${lift})`;
  };

  const frames: Keyframe[] = [{ offset: 0, transform: offsetOf(points[0] as TrailPoint) }];
  for (let index = 0; index < segments; index += 1) {
    const from = points[index] as TrailPoint;
    const to = points[index + 1] as TrailPoint;
    const startsAt = index / segments;
    const endsAt = (index + 1) / segments;
    const arrivesAt = startsAt + (endsAt - startsAt) * (1 - HOP_SETTLE);
    frames.push({
      offset: startsAt + (arrivesAt - startsAt) / 2,
      transform: offsetOf({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, 1 + HOP_LIFT),
    });
    frames.push({ offset: arrivesAt, transform: offsetOf(to) });
    frames.push({ offset: endsAt, transform: offsetOf(to) });
  }
  return frames;
}

function supportsAnimate(element: SVGGElement): boolean {
  return typeof element.animate === 'function';
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
