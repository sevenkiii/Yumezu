import { describe, expect, it } from 'vitest';

import { createRngCursor, createRngStreamNamed } from '../src/core/RNG';
import { distance, distancesFrom, reachableWithin } from '../src/map/Graph';
import { PHASE1_MAP, PHASE1_SPAWN_CENTERS } from '../src/map/fixtures';
import {
  DEFAULT_SPAWN_PARAMS,
  computeSpawnInfo,
  graphCenter,
  listSpawnCandidates,
  regionMinDistance,
  selectSpawnCenters,
} from '../src/map/SpawnGenerator';

function cursor(seed: string) {
  return createRngCursor(createRngStreamNamed(seed, 'spawn'));
}

describe('出生点选择', () => {
  it('每个候选都满足全部约束', () => {
    const candidates = listSpawnCandidates(PHASE1_MAP, DEFAULT_SPAWN_PARAMS);
    expect(candidates.length).toBeGreaterThan(0);

    const allDistances = new Map(
      PHASE1_MAP.vertices.map((vertex) => [vertex.id, distancesFrom(PHASE1_MAP, vertex.id)]),
    );

    for (const candidate of candidates) {
      const { P1, P2 } = candidate.centers;
      expect(candidate.centerDistance).toBeGreaterThanOrEqual(6);
      expect(candidate.centerDistance).toBeLessThanOrEqual(8);
      expect(candidate.balance).toBeLessThanOrEqual(1);
      expect(candidate.regionSizes.P1).toBeGreaterThanOrEqual(3);
      expect(candidate.regionSizes.P2).toBeGreaterThanOrEqual(3);

      const gap = regionMinDistance(
        reachableWithin(PHASE1_MAP, P1, 1),
        reachableWithin(PHASE1_MAP, P2, 1),
        allDistances,
      );
      expect(gap).toBeGreaterThanOrEqual(5);
    }
  });

  it('Phase 1 固定地图的出生中心仍在合格候选之中', () => {
    const candidates = listSpawnCandidates(PHASE1_MAP, DEFAULT_SPAWN_PARAMS);
    const found = candidates.some(
      (candidate) =>
        candidate.centers.P1 === PHASE1_SPAWN_CENTERS.P1 &&
        candidate.centers.P2 === PHASE1_SPAWN_CENTERS.P2,
    );
    expect(found).toBe(true);
  });

  it('地图中心是偏心距最小的节点', () => {
    const center = graphCenter(PHASE1_MAP);
    const eccentricity = (id: number): number =>
      Math.max(...Array.from(distancesFrom(PHASE1_MAP, id).values()));
    const best = Math.min(...PHASE1_MAP.vertices.map((vertex) => eccentricity(vertex.id)));
    expect(eccentricity(center)).toBe(best);
  });

  it('相同随机流选出相同中心；没有候选时返回 null', () => {
    const first = selectSpawnCenters(PHASE1_MAP, cursor('same'), DEFAULT_SPAWN_PARAMS);
    const second = selectSpawnCenters(PHASE1_MAP, cursor('same'), DEFAULT_SPAWN_PARAMS);
    expect(first).toEqual(second);
    expect(first).not.toBeNull();

    const impossible = selectSpawnCenters(PHASE1_MAP, cursor('x'), {
      ...DEFAULT_SPAWN_PARAMS,
      distanceRange: [1, 1],
    });
    expect(impossible).toBeNull();
  });

  it('computeSpawnInfo 给出中心与区域', () => {
    const spawn = computeSpawnInfo(PHASE1_MAP, PHASE1_SPAWN_CENTERS);
    expect(spawn.P1.center).toBe(PHASE1_SPAWN_CENTERS.P1);
    expect(spawn.P1.region).toEqual([0, 1, 6]);
    expect(spawn.P2.region.length).toBe(5);
    expect(distance(PHASE1_MAP, spawn.P1.center, spawn.P2.center)).toBe(7);
  });
});
