/**
 * 位移轨迹：把"这一批事件"翻译成 token 应该走的那条线。
 *
 * 引擎的 MOVED 事件只带起点与终点，逐跳路径得按地图自己算（shortestPath）；
 * SWAP 则是两个人对穿，连一条直线就够了。
 *
 * 纯函数：不碰 DOM，也不读 GameState，输入只有事件与坐标表，所以可以直接单测。
 */

import type { GameEvent } from '../core/Event';
import type { CharacterId, CharacterState, EdgeKey, VertexId } from '../core/GameState';
import type { Graph } from '../map/Graph';
import { shortestPath } from '../map/Graph';

export interface TrailPoint {
  readonly x: number;
  readonly y: number;
}

export interface TokenTrail {
  readonly characterId: CharacterId;
  /** 依次经过的坐标（含起点与终点），长度至少 2。 */
  readonly points: readonly TrailPoint[];
}

export interface TokenTrailContext {
  /** 节点 id → 棋盘坐标。 */
  readonly positions: ReadonlyMap<VertexId, TrailPoint>;
  /**
   * 角色 id → **结算之后**所在的节点。
   * SWAP 事件只给了两个角色 id，用它可以反推各自的起点（对方的当前位置）。
   */
  readonly positionOfCharacter: ReadonlyMap<CharacterId, VertexId>;
  /**
   * 逐跳路径（相邻节点的连线）。第三个参数是**谁在走**——路径要按这个角色的
   * 移动规则算（封路、敌方角色都不可穿越），见 `createMovePathOf`。
   */
  readonly pathOfMove: (from: VertexId, to: VertexId, mover: CharacterId) => VertexId[];
}

/**
 * 造一个"按引擎的移动规则走"的路径函数（`RULES.md` §8.1）。
 *
 * 只按图上的最短路画线是不够的：那样会画出"贴着封路走"甚至"穿过敌人"的路线——
 * 引擎算移动距离时把**封锁的边**与**敌方角色所在节点**都当成不可通行，
 * 界面画轨迹 / 让 token 走过去时必须用同一套约束，否则演出与规则对不上。
 * （友方角色可以穿过，与规则一致。）
 */
export function createMovePathOf(
  graph: Graph,
  blockedEdges: ReadonlySet<EdgeKey>,
  characters: readonly CharacterState[],
): (from: VertexId, to: VertexId, mover: CharacterId) => VertexId[] {
  return (from, to, mover) => {
    const walker = characters.find((character) => character.id === mover);
    const impassable = new Set<VertexId>();
    for (const character of characters) {
      if (!character.alive || character.id === mover) continue;
      if (walker !== undefined && character.owner === walker.owner) continue;
      impassable.add(character.position);
    }
    // 找不到路就返回空：宁可什么都不画，也不要画一条穿墙的线
    // （合法移动一定找得到路，这里只是兜底）
    return shortestPath(graph, from, to, { blockedEdges, impassable }) ?? [];
  };
}

export function buildTokenTrails(
  events: readonly GameEvent[],
  context: TokenTrailContext,
): readonly TokenTrail[] {
  const trails = new Map<CharacterId, TrailPoint[]>();

  const append = (characterId: CharacterId, points: readonly TrailPoint[]): void => {
    if (points.length === 0) return;
    const existing = trails.get(characterId);
    if (existing === undefined) {
      trails.set(characterId, [...points]);
      return;
    }
    // 同一批事件里连续位移（例如被卡牌推着走）：接起来，跳过重复的衔接点
    for (const point of points) {
      const last = existing[existing.length - 1];
      if (last === undefined || last.x !== point.x || last.y !== point.y) existing.push(point);
    }
  };

  const pointAt = (vertex: VertexId): TrailPoint | undefined => context.positions.get(vertex);

  for (const event of events) {
    if (event.type === 'MOVED') {
      const points = context
        .pathOfMove(event.from, event.to, event.characterId)
        .map(pointAt)
        .filter((point): point is TrailPoint => point !== undefined);
      append(event.characterId, points);
      continue;
    }

    if (event.type === 'SWAPPED') {
      const aHere = context.positionOfCharacter.get(event.a);
      const bHere = context.positionOfCharacter.get(event.b);
      if (aHere === undefined || bHere === undefined) continue;
      const aPoint = pointAt(aHere);
      const bPoint = pointAt(bHere);
      if (aPoint === undefined || bPoint === undefined) continue;
      // 换位之后 a 站在 b 原来的位置，所以 a 是从"b 现在的位置"滑过去的
      append(event.a, [bPoint, aPoint]);
      append(event.b, [aPoint, bPoint]);
    }
  }

  return [...trails]
    .filter(([, points]) => points.length >= 2)
    .map(([characterId, points]) => ({ characterId, points }));
}
