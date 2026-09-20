import { describe, expect, it } from 'vitest';

import { distance, reachableWithin } from '../src/map/Graph';
import { DEFAULT_MAP_PARAMS, MapGenerationError, generateMap } from '../src/map/MapGenerator';
import { edgeKeysOf, validateMapStructure } from '../src/map/MapValidator';
import { PHASE1_MAP } from '../src/map/fixtures';

describe('地图生成的确定性', () => {
  it('相同 mapSeed 生成完全相同的地图与出生点', () => {
    const first = generateMap('det-1');
    const second = generateMap('det-1');
    expect(edgeKeysOf(first.graph)).toEqual(edgeKeysOf(second.graph));
    expect(first.graph.vertices.map((vertex) => [vertex.x, vertex.y])).toEqual(
      second.graph.vertices.map((vertex) => [vertex.x, vertex.y]),
    );
    expect(first.spawnCenters).toEqual(second.spawnCenters);
    expect(first.attempts).toBe(second.attempts);
  });

  it('不同 mapSeed 生成不同地图', () => {
    expect(edgeKeysOf(generateMap('det-a').graph)).not.toEqual(
      edgeKeysOf(generateMap('det-b').graph),
    );
  });
});

describe('地图生成的质量', () => {
  it('40 个 seed 全部合格，且规模符合 V1 目标', () => {
    for (let index = 0; index < 40; index += 1) {
      const map = generateMap('sweep-' + index);
      const stats = map.stats;

      expect(stats.nodeCount).toBe(30);
      expect(stats.edgeCount).toBeGreaterThanOrEqual(40);
      expect(stats.edgeCount).toBeLessThanOrEqual(50);
      expect(stats.diameter).toBeGreaterThanOrEqual(7);
      expect(stats.diameter).toBeLessThanOrEqual(10);
      expect(stats.degreeOneCount).toBe(0);
      expect(stats.maxDegree).toBeLessThanOrEqual(6);
      expect(stats.bridgeCount).toBe(0);
      expect(stats.connected).toBe(true);
      expect(stats.crossingEdgePairs).toBe(0);
      expect(map.attempts).toBeLessThanOrEqual(50);
    }
  }, 60000);

  it('生成的出生点满足 RULES.md §5 的全部约束', () => {
    for (let index = 0; index < 12; index += 1) {
      const map = generateMap('spawn-' + index);
      const { P1, P2 } = map.spawnCenters;
      const gap = distance(map.graph, P1, P2);

      expect(gap).toBeGreaterThanOrEqual(6);
      expect(gap).toBeLessThanOrEqual(8);

      const regionP1 = reachableWithin(map.graph, P1, 1);
      const regionP2 = reachableWithin(map.graph, P2, 1);
      expect(regionP1.length).toBeGreaterThanOrEqual(3);
      expect(regionP2.length).toBeGreaterThanOrEqual(3);

      let minimum = Number.POSITIVE_INFINITY;
      for (const a of regionP1) {
        for (const b of regionP2) {
          minimum = Math.min(minimum, distance(map.graph, a, b));
        }
      }
      expect(minimum).toBeGreaterThanOrEqual(5);
    }
  }, 60000);
});

describe('失败处理', () => {
  it('阈值不可能满足时抛出带统计的错误，而不是静默放宽', () => {
    let caught: MapGenerationError | null = null;
    try {
      generateMap('impossible', { diameterRange: [50, 60], maxAttempts: 5 });
    } catch (error) {
      caught = error as MapGenerationError;
    }
    expect(caught).toBeInstanceOf(MapGenerationError);
    expect(caught?.attempts).toBe(5);
    expect(caught?.failures.DIAMETER).toBeGreaterThan(0);
  }, 60000);
});

describe('与 Phase 1 固定地图的一致性', () => {
  it('固定网格地图也满足同一套结构校验', () => {
    const result = validateMapStructure(PHASE1_MAP, DEFAULT_MAP_PARAMS);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.stats.edgeCount).toBe(49);
    expect(result.stats.diameter).toBe(9);
  });
});
