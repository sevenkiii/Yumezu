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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import type { CharacterId } from '../core/GameState';
import {
  HOP_SETTLE,
  KNOCK_DISTANCE,
  LUNGE_ANTICIPATE,
  LUNGE_APPROACH,
  LUNGE_BACK,
  LUNGE_HOLD,
  LUNGE_IMPACT,
  LUNGE_MAX,
  LUNGE_MS,
  LUNGE_SCALE,
  STAGGER_MS,
  lungeDelayMs,
  trailDurationMs,
  trailDurationsOf,
} from './motionTiming';
import type { TokenLunge, TokenTrail, TrailPoint } from './tokenTrail';

/** 跳起时放大一点，像是离开了桌面；设为 0 就退化成纯平移。 */
const HOP_LIFT = 0.14;

export interface TokenMotion {
  /** 交给 <g className="token"> 的 ref 回调。 */
  readonly setTokenRef: (characterId: CharacterId, element: SVGGElement | null) => void;
}

/** SSR（渲染冒烟测试）里没有 DOM，退回 useEffect 以免 React 报警。 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useTokenMotion(
  trails: readonly TokenTrail[],
  lunges: readonly TokenLunge[] = [],
): TokenMotion {
  const elements = useRef(new Map<CharacterId, SVGGElement>());
  const running = useRef(new Map<CharacterId, Animation>());
  /** 角色 id → 这一批里它走位要花的时间（没走位就是 0）。 */
  const trailDurations = useMemo(() => trailDurationsOf(trails), [trails]);

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
          duration: trailDurationMs(trail),
          delay: index * STAGGER_MS,
          easing: 'ease-in-out',
          fill: 'none',
        }),
      );
    });
  }, [trails]);

  // 撞击：出手方冲过去，目标被顶一下。两者都在内层 token__lunge 上做，
  // 所以"先移动后攻击"（例如星奔）时，撞击是叠在走位之上的。
  useIsomorphicLayoutEffect(() => {
    if (lunges.length === 0 || prefersReducedMotion()) return;
    lunges.forEach((lunge, index) => {
      // 先走完再撞：同一个角色这一批里如果先位移了，撞击要等它到位
      const delay = lungeDelayMs(lunge, trailDurations, index);
      const attacker = motionOf(elements.current.get(lunge.characterId));
      if (attacker !== null) {
        start(attacker, lungeKeyframes(lunge), {
          duration: LUNGE_MS,
          delay,
          easing: 'ease-in-out',
        });
      }
      const target = motionOf(elements.current.get(lunge.targetId));
      if (target !== null) {
        start(target, knockKeyframes(lunge), {
          duration: LUNGE_MS * 0.55,
          delay: delay + LUNGE_MS * LUNGE_IMPACT,
          easing: 'ease-out',
        });
      }
    });
  }, [lunges, trailDurations]);

  useEffect(() => {
    const animations = running.current;
    return () => {
      for (const animation of animations.values()) animation.cancel();
      animations.clear();
    };
  }, []);

  return { setTokenRef };
}

/** 内层的运动层：走位在外层，撞击叠加在这里，两者互不干扰。 */
function motionOf(element: SVGGElement | undefined): SVGGElement | null {
  if (element === undefined) return null;
  const inner = element.querySelector('.token__lunge');
  return inner instanceof SVGGElement ? inner : null;
}

function start(
  element: SVGGElement,
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions,
): void {
  for (const running of element.getAnimations()) running.cancel();
  element.animate(keyframes, { ...timing, fill: 'none' });
}

/** 出手方：冲过去撞一下再退回原位。 */
function lungeKeyframes(lunge: TokenLunge): Keyframe[] {
  const dx = lunge.to.x - lunge.from.x;
  const dy = lunge.to.y - lunge.from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [{ transform: 'none' }];
  const reach = Math.min(distance * LUNGE_APPROACH, LUNGE_MAX);
  const x = ((dx / distance) * reach).toFixed(2);
  const y = ((dy / distance) * reach).toFixed(2);
  const backX = ((-dx / distance) * LUNGE_BACK).toFixed(2);
  const backY = ((-dy / distance) * LUNGE_BACK).toFixed(2);
  return [
    { offset: 0, transform: 'translate(0px, 0px)', easing: 'ease-in' },
    // 先微微后仰蓄力，再冲出去
    {
      offset: LUNGE_ANTICIPATE,
      transform: `translate(${backX}px, ${backY}px)`,
      easing: 'ease-out',
    },
    { offset: LUNGE_IMPACT, transform: `translate(${x}px, ${y}px) scale(${LUNGE_SCALE})` },
    { offset: LUNGE_HOLD, transform: `translate(${x}px, ${y}px) scale(1.04)` },
    { offset: 1, transform: 'translate(0px, 0px)' },
  ];
}

/** 目标：被顶开、抖一下再回位。 */
function knockKeyframes(lunge: TokenLunge): Keyframe[] {
  const dx = lunge.to.x - lunge.from.x;
  const dy = lunge.to.y - lunge.from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [{ transform: 'none' }];
  const x = ((-dx / distance) * KNOCK_DISTANCE).toFixed(2);
  const y = ((-dy / distance) * KNOCK_DISTANCE).toFixed(2);
  return [
    { offset: 0, transform: 'translate(0px, 0px)' },
    { offset: 0.35, transform: `translate(${x}px, ${y}px)`, easing: 'ease-out' },
    {
      offset: 0.7,
      transform: `translate(${(Number(x) * 0.25).toFixed(2)}px, ${(Number(y) * 0.25).toFixed(2)}px)`,
    },
    { offset: 1, transform: 'translate(0px, 0px)' },
  ];
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
