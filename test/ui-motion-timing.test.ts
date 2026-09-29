/**
 * 表现层节奏：走位时长、撞击的起手延迟、动画窗口够不够长。
 */

import { describe, expect, it } from 'vitest';

import type { CharacterId } from '../src/core/GameState';
import {
  HOP_MS,
  LUNGE_MS,
  MOTION_WINDOW_MS,
  STAGGER_MS,
  lungeDelayMs,
  trailDurationMs,
  trailDurationsOf,
} from '../src/ui/motionTiming';
import type { TokenLunge, TokenTrail, TrailPoint } from '../src/ui/tokenTrail';

const ALICE = 'P1:Spica' as CharacterId;
const BOB = 'P2:Lily' as CharacterId;

const point = (x: number): TrailPoint => ({ x, y: 0 });

function trail(characterId: CharacterId, hops: number): TokenTrail {
  return {
    characterId,
    points: Array.from({ length: hops + 1 }, (_, index) => point(index * 10)),
  };
}

function lunge(characterId: CharacterId): TokenLunge {
  return { characterId, targetId: BOB, from: point(0), to: point(50) };
}

describe('走位与撞击的节奏', () => {
  it('走位时长 = 跳数 × 每跳时长', () => {
    expect(trailDurationMs(trail(ALICE, 1))).toBe(HOP_MS);
    expect(trailDurationMs(trail(ALICE, 3))).toBe(HOP_MS * 3);
  });

  it('没走位的角色，撞击立刻开始', () => {
    const durations = trailDurationsOf([trail(BOB, 2)]);
    expect(lungeDelayMs(lunge(ALICE), durations, 0)).toBe(0);
  });

  it('先走位再撞：撞击要等出手方走完（星奔这类）', () => {
    const walk = trail(ALICE, 3);
    const durations = trailDurationsOf([walk, trail(BOB, 1)]);
    expect(lungeDelayMs(lunge(ALICE), durations, 0)).toBe(trailDurationMs(walk));
    // 同一批里的第二下再错开一点
    expect(lungeDelayMs(lunge(BOB), durations, 1)).toBe(
      trailDurationMs(trail(BOB, 1)) + STAGGER_MS,
    );
  });

  it('动画窗口够放完最长的一段：走 4 跳 + 撞击', () => {
    expect(MOTION_WINDOW_MS).toBeGreaterThanOrEqual(trailDurationMs(trail(ALICE, 4)) + LUNGE_MS);
  });
});
