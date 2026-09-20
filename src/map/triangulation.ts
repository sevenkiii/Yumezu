/**
 * Delaunay 三角剖分的唯一封装处。
 *
 * 约定（RULES.md §4.4）：第三方三角剖分库只允许在本文件里引用；
 * 将来替换实现时，只要保持 delaunayEdges 的签名即可。
 */

import Delaunator from 'delaunator';

import { edgeKey, type Edge } from './Graph';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * 对给定点集做 Delaunay 三角剖分，返回去重后的边集合。
 * 点全部共线等退化情况下返回空数组，由调用方当作一次失败的尝试处理。
 */
export function delaunayEdges(points: readonly Point[]): Edge[] {
  if (points.length < 3) return [];

  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i] as Point;
    coords[i * 2] = point.x;
    coords[i * 2 + 1] = point.y;
  }

  const triangulation = new Delaunator(coords);
  const triangles = triangulation.triangles;
  if (triangles.length === 0) return [];

  const seen = new Set<string>();
  const edges: Edge[] = [];
  const addEdge = (a: number, b: number): void => {
    const key = edgeKey(a, b);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b });
  };

  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] as number;
    const b = triangles[i + 1] as number;
    const c = triangles[i + 2] as number;
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }
  return edges;
}

/** 凸包上的点（按逆时针顺序），供调试与测试使用。 */
export function delaunayHull(points: readonly Point[]): number[] {
  if (points.length < 3) return [];
  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i] as Point;
    coords[i * 2] = point.x;
    coords[i * 2 + 1] = point.y;
  }
  return Array.from(new Delaunator(coords).hull);
}
