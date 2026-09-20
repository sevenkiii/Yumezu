/**
 * 图结构：顶点、边、无权最短路与可达性。
 *
 * 见 RULES.md「距离」：
 *  - 图距离：忽略封锁的最短路，用于普通攻击 / 技能 / 换位。
 *  - 移动距离：把封锁边视为不可通行，用于一切位移。
 *
 * 本模块不依赖引擎状态，是纯粹的数据结构工具。
 */

export type VertexId = number;

/** 边的唯一键：始终写成 "较小 id-较大 id"。 */
export type EdgeKey = string;

export interface Vertex {
  readonly id: VertexId;
  readonly x: number;
  readonly y: number;
}

export interface Edge {
  readonly a: VertexId;
  readonly b: VertexId;
}

export interface Graph {
  readonly vertices: readonly Vertex[];
  readonly edges: readonly Edge[];
}

export interface DistanceOptions {
  /** 不可通行的边（封路）。 */
  readonly blockedEdges?: ReadonlySet<EdgeKey>;
  /** 不可进入的节点（例如路径上的敌方角色）。起点不受此限制。 */
  readonly impassable?: ReadonlySet<VertexId>;
}

export function edgeKey(a: VertexId, b: VertexId): EdgeKey {
  return a < b ? a + '-' + b : b + '-' + a;
}

export function edgeKeyOf(edge: Edge): EdgeKey {
  return edgeKey(edge.a, edge.b);
}

export function parseEdgeKey(key: EdgeKey): { a: VertexId; b: VertexId } {
  const parts = key.split('-');
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new Error('parseEdgeKey: 非法边键 ' + key);
  }
  return { a, b };
}

/** 邻接表：每次调用重建。图规模很小（约 30 节点），无需缓存。 */
export function buildAdjacency(graph: Graph): Map<VertexId, { to: VertexId; key: EdgeKey }[]> {
  const adjacency = new Map<VertexId, { to: VertexId; key: EdgeKey }[]>();
  for (const vertex of graph.vertices) {
    adjacency.set(vertex.id, []);
  }
  for (const edge of graph.edges) {
    const key = edgeKeyOf(edge);
    const listA = adjacency.get(edge.a);
    const listB = adjacency.get(edge.b);
    if (listA === undefined || listB === undefined) {
      throw new Error('buildAdjacency: 边引用了不存在的顶点');
    }
    listA.push({ to: edge.b, key });
    listB.push({ to: edge.a, key });
  }
  return adjacency;
}

export function neighbors(graph: Graph, vertex: VertexId): VertexId[] {
  const adjacency = buildAdjacency(graph);
  const list = adjacency.get(vertex) ?? [];
  return list.map((entry) => entry.to);
}

export function hasEdge(graph: Graph, a: VertexId, b: VertexId): boolean {
  const key = edgeKey(a, b);
  return graph.edges.some((edge) => edgeKeyOf(edge) === key);
}

export function degree(graph: Graph, vertex: VertexId): number {
  return neighbors(graph, vertex).length;
}

/** 单个起点到所有节点的最短路距离（BFS，边权为 1）。 */
export function distancesFrom(
  graph: Graph,
  from: VertexId,
  options: DistanceOptions = {},
): Map<VertexId, number> {
  const adjacency = buildAdjacency(graph);
  const dist = new Map<VertexId, number>();
  if (!adjacency.has(from)) return dist;
  dist.set(from, 0);
  const queue: VertexId[] = [from];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head] as VertexId;
    head += 1;
    const currentDist = dist.get(current) as number;
    const entries = adjacency.get(current) ?? [];
    for (const entry of entries) {
      if (options.blockedEdges !== undefined && options.blockedEdges.has(entry.key)) continue;
      if (options.impassable !== undefined && options.impassable.has(entry.to)) continue;
      if (dist.has(entry.to)) continue;
      dist.set(entry.to, currentDist + 1);
      queue.push(entry.to);
    }
  }
  return dist;
}

/** 两点之间的最短路距离；不可达时返回 Infinity。 */
export function distance(
  graph: Graph,
  a: VertexId,
  b: VertexId,
  options: DistanceOptions = {},
): number {
  if (a === b) return 0;
  const dist = distancesFrom(graph, a, options);
  return dist.get(b) ?? Number.POSITIVE_INFINITY;
}

/** 距离不超过 range 的所有节点（含起点自身）。 */
export function reachableWithin(
  graph: Graph,
  from: VertexId,
  range: number,
  options: DistanceOptions = {},
): VertexId[] {
  const dist = distancesFrom(graph, from, options);
  const out: VertexId[] = [];
  for (const [vertex, d] of dist) {
    if (d <= range) out.push(vertex);
  }
  return out.sort((x, y) => x - y);
}

export function connectedComponents(graph: Graph): VertexId[][] {
  const seen = new Set<VertexId>();
  const components: VertexId[][] = [];
  for (const vertex of graph.vertices) {
    if (seen.has(vertex.id)) continue;
    const component: VertexId[] = [];
    const dist = distancesFrom(graph, vertex.id);
    for (const id of dist.keys()) {
      seen.add(id);
      component.push(id);
    }
    components.push(component.sort((x, y) => x - y));
  }
  return components;
}

export function isConnected(graph: Graph): boolean {
  return connectedComponents(graph).length === 1;
}

/** 割边（桥）：删除后会让图不连通的边。 */
export function bridges(graph: Graph): EdgeKey[] {
  const out: EdgeKey[] = [];
  for (const edge of graph.edges) {
    const key = edgeKeyOf(edge);
    const rest: Graph = {
      vertices: graph.vertices,
      edges: graph.edges.filter((item) => edgeKeyOf(item) !== key),
    };
    if (!isConnected(rest)) out.push(key);
  }
  return out.sort();
}

/** 割点：删除后会让图不连通的顶点。 */
export function articulationPoints(graph: Graph): VertexId[] {
  const out: VertexId[] = [];
  for (const vertex of graph.vertices) {
    const rest: Graph = {
      vertices: graph.vertices.filter((item) => item.id !== vertex.id),
      edges: graph.edges.filter((edge) => edge.a !== vertex.id && edge.b !== vertex.id),
    };
    if (rest.vertices.length === 0) continue;
    if (!isConnected(rest)) out.push(vertex.id);
  }
  return out.sort((x, y) => x - y);
}

/** 图直径：所有点对最短距离的最大值（不可达的点对忽略）。 */
export function diameter(graph: Graph): number {
  let best = 0;
  for (const vertex of graph.vertices) {
    const dist = distancesFrom(graph, vertex.id);
    for (const d of dist.values()) {
      if (d > best) best = d;
    }
  }
  return best;
}
