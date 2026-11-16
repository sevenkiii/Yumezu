import { describe, expect, it } from 'vitest';

import {
  articulationPoints,
  bridges,
  connectedComponents,
  degree,
  diameter,
  distance,
  edgeKey,
  neighbors,
  reachableWithin,
  shortestPath,
} from '../src/map/Graph';
import { PHASE1_MAP, PHASE1_SPAWN_CENTERS } from '../src/map/fixtures';

describe('Phase 1 固定地图的规模与结构', () => {
  it('规模、连通性与度数都满足 Validator 阈值', () => {
    expect(PHASE1_MAP.vertices).toHaveLength(30);
    expect(PHASE1_MAP.edges).toHaveLength(49);
    // 不存在单一超级瓶颈
    expect(connectedComponents(PHASE1_MAP)).toHaveLength(1);
    expect(bridges(PHASE1_MAP)).toEqual([]);
    expect(articulationPoints(PHASE1_MAP)).toEqual([]);

    const degrees = PHASE1_MAP.vertices.map((vertex) => degree(PHASE1_MAP, vertex.id));
    expect(Math.min(...degrees)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...degrees)).toBeLessThanOrEqual(6);
    expect(degrees.filter((value) => value === 1)).toHaveLength(0);
    expect(diameter(PHASE1_MAP)).toBe(9);
  });
});

describe('Phase 1 出生中心', () => {
  it('中心距离 7（要求 7 ~ 9），两区域各 >= 3 且最小距离 >= 5', () => {
    expect(distance(PHASE1_MAP, PHASE1_SPAWN_CENTERS.P1, PHASE1_SPAWN_CENTERS.P2)).toBe(7);

    const regionA = reachableWithin(PHASE1_MAP, PHASE1_SPAWN_CENTERS.P1, 1);
    const regionB = reachableWithin(PHASE1_MAP, PHASE1_SPAWN_CENTERS.P2, 1);
    expect(regionA.length).toBeGreaterThanOrEqual(3);
    expect(regionB.length).toBeGreaterThanOrEqual(3);

    let minimum = Number.POSITIVE_INFINITY;
    for (const a of regionA) {
      for (const b of regionB) {
        minimum = Math.min(minimum, distance(PHASE1_MAP, a, b));
      }
    }
    expect(minimum).toBeGreaterThanOrEqual(5);
  });
});

describe('图工具', () => {
  it('距离对称且自身为 0；封路只改变移动距离', () => {
    expect(distance(PHASE1_MAP, 0, 0)).toBe(0);
    expect(distance(PHASE1_MAP, 0, 29)).toBe(9);
    expect(distance(PHASE1_MAP, 0, 29)).toBe(distance(PHASE1_MAP, 29, 0));

    const firstNeighbor = neighbors(PHASE1_MAP, 0)[0] as number;
    const blocked = new Set([edgeKey(0, firstNeighbor)]);
    expect(distance(PHASE1_MAP, 0, firstNeighbor)).toBe(1);
    expect(distance(PHASE1_MAP, 0, firstNeighbor, { blockedEdges: blocked })).toBeGreaterThan(1);
  });

  it('可达范围与逐跳路径（含封路后绕行）', () => {
    expect(reachableWithin(PHASE1_MAP, 0, 1).sort((a, b) => a - b)).toEqual([0, 1, 6]);
    expect(shortestPath(PHASE1_MAP, 0, 2)).toEqual([0, 1, 2]);
    expect(shortestPath(PHASE1_MAP, 5, 5)).toEqual([5]);
    // 封锁边之后绕路，路径变长
    expect(shortestPath(PHASE1_MAP, 0, 1, { blockedEdges: new Set([edgeKey(0, 1)]) })).toEqual([
      0, 6, 7, 1,
    ]);
  });
});
