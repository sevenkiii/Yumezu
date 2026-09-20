/**
 * Phase 1 使用的固定地图。
 *
 * Phase 2 会用真正的随机生成器（Delaunay + MST + Validator）替换本文件的角色，
 * 在此之前用一个确定性网格图跑通整个引擎。
 *
 * 默认 6 x 5 网格 = 30 节点 / 49 条边 / 平均度 3.27 / 直径 9，
 * 无度数 1 的节点、无桥、无割点，满足 RULES.md 的 Validator 阈值。
 */

import type { Graph } from './Graph';

export const PHASE1_GRID_WIDTH = 6;
export const PHASE1_GRID_HEIGHT = 5;

/** 顶点 id = y * width + x。 */
export function createGridGraph(width: number, height: number): Graph {
  if (width < 2 || height < 2) throw new Error('createGridGraph: 尺寸至少为 2 x 2');
  const vertices = [];
  const edges = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      vertices.push({ id: y * width + x, x, y });
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = y * width + x;
      if (x + 1 < width) edges.push({ a: id, b: y * width + (x + 1) });
      if (y + 1 < height) edges.push({ a: id, b: (y + 1) * width + x });
    }
  }
  return { vertices, edges };
}

export const PHASE1_MAP: Graph = createGridGraph(PHASE1_GRID_WIDTH, PHASE1_GRID_HEIGHT);

/**
 * Phase 1 固定的出生中心（均由 6 x 5 网格验证过）：
 *  - 两中心距离 = 7（要求 6 ~ 8）
 *  - 两出生区域最小距离 = 5（要求 >= 5）
 *  - 到地图中心节点 14 的距离为 4 与 3，差 1（要求 <= 1）
 *  - 区域大小 = 3 与 5（要求 >= 3）
 */
export const PHASE1_SPAWN_CENTERS: { readonly P1: number; readonly P2: number } = {
  P1: 0,
  P2: 22,
};
