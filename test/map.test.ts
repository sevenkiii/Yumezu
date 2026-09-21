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
  it('是 30 节点 / 49 边的网格图', () => {
    expect(PHASE1_MAP.vertices).toHaveLength(30);
    expect(PHASE1_MAP.edges).toHaveLength(49);
  });

  it('连通、无桥、无割点（满足"不存在单一超级瓶颈"）', () => {
    expect(connectedComponents(PHASE1_MAP)).toHaveLength(1);
    expect(bridges(PHASE1_MAP)).toEqual([]);
    expect(articulationPoints(PHASE1_MAP)).toEqual([]);
  });

  it('度数分布与直径满足 Validator 阈值', () => {
    const degrees = PHASE1_MAP.vertices.map((vertex) => degree(PHASE1_MAP, vertex.id));
    expect(Math.min(...degrees)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...degrees)).toBeLessThanOrEqual(6);
    expect(degrees.filter((value) => value === 1)).toHaveLength(0);
    expect(diameter(PHASE1_MAP)).toBe(9);
  });
});

describe('Phase 1 出生中心', () => {
  it('两中心距离为 7（要求 6 ~ 8）', () => {
    expect(distance(PHASE1_MAP, PHASE1_SPAWN_CENTERS.P1, PHASE1_SPAWN_CENTERS.P2)).toBe(7);
  });

  it('两出生区域大小 >= 3 且最小距离 >= 5', () => {
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
  it('距离对称，自身为 0', () => {
    expect(distance(PHASE1_MAP, 0, 0)).toBe(0);
    expect(distance(PHASE1_MAP, 0, 29)).toBe(9);
    expect(distance(PHASE1_MAP, 0, 29)).toBe(distance(PHASE1_MAP, 29, 0));
  });

  it('封锁边会改变移动距离（图距离不受影响）', () => {
    const firstNeighbor = neighbors(PHASE1_MAP, 0)[0] as number;
    const blocked = new Set([edgeKey(0, firstNeighbor)]);
    expect(distance(PHASE1_MAP, 0, firstNeighbor, { blockedEdges: blocked })).toBeGreaterThan(1);
    expect(distance(PHASE1_MAP, 0, firstNeighbor)).toBe(1);
  });

  it('reachableWithin 返回距离不超过上限的节点', () => {
    expect(reachableWithin(PHASE1_MAP, 0, 1).sort((a, b) => a - b)).toEqual([0, 1, 6]);
  });

  it('shortestPath 给出沿边逐跳的路径（用于移动动画）', () => {
    const path = shortestPath(PHASE1_MAP, 0, 2);
    expect(path).toEqual([0, 1, 2]);
    expect(shortestPath(PHASE1_MAP, 5, 5)).toEqual([5]);

    // 封锁边之后绕路，路径变长
    const detour = shortestPath(PHASE1_MAP, 0, 1, { blockedEdges: new Set([edgeKey(0, 1)]) });
    expect(detour).toEqual([0, 6, 7, 1]);
  });
});
