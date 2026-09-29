/**
 * 位移轨迹：MOVED 走地图上的逐跳路径，SWAP 走对穿直线。
 */

import { describe, expect, it } from 'vitest';

import { createCharacter } from '../src/characters/Character';
import type { GameEvent } from '../src/core/Event';
import type { CharacterId, VertexId } from '../src/core/GameState';
import { findCharacter } from '../src/core/GameState';
import { edgeKey, edgeKeyOf, shortestPath } from '../src/map/Graph';
import { PHASE1_MAP } from '../src/map/fixtures';
import { canMoveTo } from '../src/rules/MovementRules';
import {
  buildTokenTrails,
  createMovePathOf,
  type TrailPoint,
  type TokenTrailContext,
} from '../src/ui/tokenTrail';
import { createBattleState } from './support/fixtures';

const ALICE = 'P1:Mikage' as CharacterId;
const BOB = 'P2:Lily' as CharacterId;

/** 坐标表故意用整数，方便直接断言。 */
const positions = new Map<VertexId, TrailPoint>(
  PHASE1_MAP.vertices.map((vertex) => [vertex.id, { x: vertex.id, y: vertex.id }]),
);

const pathOfMove = (from: VertexId, to: VertexId): VertexId[] =>
  shortestPath(PHASE1_MAP, from, to) ?? [from, to];

function context(positionOfCharacter: ReadonlyMap<CharacterId, VertexId>): TokenTrailContext {
  return { positions, positionOfCharacter, pathOfMove };
}

function moved(characterId: CharacterId, from: VertexId, to: VertexId): GameEvent {
  return { type: 'MOVED', characterId, from, to, cause: 'MOVE' };
}

/** 在夹具地图上找一对至少两跳的节点。 */
function findDistantPair(): { from: VertexId; to: VertexId; path: VertexId[] } {
  for (const a of PHASE1_MAP.vertices) {
    for (const b of PHASE1_MAP.vertices) {
      const path = shortestPath(PHASE1_MAP, a.id, b.id);
      if (path !== null && path.length >= 3) return { from: a.id, to: b.id, path };
    }
  }
  throw new Error('夹具地图上找不到两跳以上的点对');
}

describe('buildTokenTrails', () => {
  it('MOVED 沿图上的逐跳路径走', () => {
    const { from, to, path } = findDistantPair();
    const trails = buildTokenTrails([moved(ALICE, from, to)], context(new Map()));

    expect(trails).toHaveLength(1);
    expect(trails[0]?.characterId).toBe(ALICE);
    expect(trails[0]?.points).toEqual(path.map((vertex) => positions.get(vertex)));
    expect(trails[0]?.points.length).toBeGreaterThanOrEqual(3);
  });

  it('原地不动不产生轨迹', () => {
    const vertex = PHASE1_MAP.vertices[0]?.id as VertexId;
    expect(buildTokenTrails([moved(ALICE, vertex, vertex)], context(new Map()))).toEqual([]);
  });

  it('同一批里连续位移会接成一条，衔接点只出现一次', () => {
    const first = findDistantPair();
    const back = shortestPath(PHASE1_MAP, first.to, first.from) as VertexId[];
    const trails = buildTokenTrails(
      [moved(ALICE, first.from, first.to), moved(ALICE, first.to, first.from)],
      context(new Map()),
    );

    expect(trails).toHaveLength(1);
    const points = trails[0]?.points ?? [];
    expect(points).toHaveLength(first.path.length + back.length - 1);
    // 去程终点 = 回程起点，只保留一个
    const junction = positions.get(first.to);
    expect(points.filter((point) => point === junction)).toHaveLength(1);
  });

  it('SWAP 是两人对穿：各自从对方现在的位置出发', () => {
    const { from, to } = findDistantPair();
    // 换位之后：ALICE 站在 to，BOB 站在 from
    const after = new Map<CharacterId, VertexId>([
      [ALICE, to],
      [BOB, from],
    ]);
    const trails = buildTokenTrails([{ type: 'SWAPPED', a: ALICE, b: BOB }], context(after));

    const byId = new Map(trails.map((trail) => [trail.characterId, trail.points]));
    expect(byId.get(ALICE)).toEqual([positions.get(from), positions.get(to)]);
    expect(byId.get(BOB)).toEqual([positions.get(to), positions.get(from)]);
  });

  it('路径上缺坐标时退化成直线，而不是丢掉整个轨迹', () => {
    const { from, to, path } = findDistantPair();
    const partial = new Map(positions);
    for (const vertex of path.slice(1, -1)) partial.delete(vertex);
    const trails = buildTokenTrails([moved(ALICE, from, to)], {
      positions: partial,
      positionOfCharacter: new Map(),
      pathOfMove,
    });

    expect(trails[0]?.points).toEqual([positions.get(from), positions.get(to)]);
  });

  it('与位移无关的事件不产生轨迹', () => {
    const events: GameEvent[] = [
      { type: 'CHARACTER_DIED', characterId: ALICE },
      {
        type: 'DAMAGED',
        targetId: BOB,
        amount: 2,
        hpAfter: 8,
        source: { kind: 'ATTACK', sourceCharacterId: ALICE, sourcePlayerId: 'P1' },
      },
    ];
    expect(buildTokenTrails(events, context(new Map()))).toEqual([]);
  });
});

const MAP_EDGE_KEYS = new Set(PHASE1_MAP.edges.map((edge) => edgeKeyOf(edge)));

/** 路径的每一步都必须是图上真实存在的边。 */
function isEdgeWalk(path: readonly VertexId[]): boolean {
  for (let index = 1; index < path.length; index += 1) {
    const key = edgeKey(path[index - 1] as VertexId, path[index] as VertexId);
    if (!MAP_EDGE_KEYS.has(key)) return false;
  }
  return true;
}

describe('createMovePathOf：轨迹必须守移动规则（RULES.md §8.1）', () => {
  // 网格 6 x 5，id = y * 6 + x：0=(0,0) 1=(1,0) 6=(0,1) 7=(1,1)
  const mover = createCharacter('P1', 'Mikage', 0);

  it('绕开被封锁的边', () => {
    const blocked = new Set([edgeKey(0, 6)]);
    const path = createMovePathOf(PHASE1_MAP, blocked, [mover])(0, 6, mover.id);

    // 不带约束时最短路就是这条被封的边
    expect(shortestPath(PHASE1_MAP, 0, 6)).toEqual([0, 6]);
    // 带上约束后必须绕路，而且每一步都得是真实的边
    expect(path[0]).toBe(0);
    expect(path[path.length - 1]).toBe(6);
    expect(path.length).toBeGreaterThan(2);
    expect(isEdgeWalk(path)).toBe(true);
    for (let index = 1; index < path.length; index += 1) {
      expect(edgeKey(path[index - 1] as VertexId, path[index] as VertexId)).not.toBe(edgeKey(0, 6));
    }
  });

  it('不穿过敌方角色，但可以穿过友方角色', () => {
    const enemy = createCharacter('P2', 'Lily', 1);
    const ally = createCharacter('P1', 'Nana', 1);

    const aroundEnemy = createMovePathOf(PHASE1_MAP, new Set(), [mover, enemy])(0, 2, mover.id);
    expect(aroundEnemy).not.toContain(1);
    expect(aroundEnemy[0]).toBe(0);
    expect(aroundEnemy[aroundEnemy.length - 1]).toBe(2);
    expect(isEdgeWalk(aroundEnemy)).toBe(true);

    const throughAlly = createMovePathOf(PHASE1_MAP, new Set(), [mover, ally])(0, 2, mover.id);
    expect(throughAlly).toEqual([0, 1, 2]);
  });

  it('走不通时返回空数组，而不是画一条穿墙的直线', () => {
    const blocked = new Set([edgeKey(0, 1), edgeKey(0, 6)]);
    const path = createMovePathOf(PHASE1_MAP, blocked, [mover])(0, 7, mover.id);
    expect(path).toEqual([]);
  });

  it('这就是真会发生的场景：封路后引擎仍允许走到对面，但最短路穿过封路边', () => {
    // Spica 的移动范围是 3：直连的边被封后，绕路 3 跳仍然够得着
    const state = createBattleState({
      p1: ['Spica'],
      p2: ['Lily'],
      positions: { 'P1:Spica': 0, 'P2:Lily': 22 },
      currentPlayer: 'P1',
    });
    state.map.blockedEdges.push({ edge: edgeKey(0, 6), owner: 'P2', expiresAtTurnIndex: 99 });
    const walker = findCharacter(state, 'P1:Spica');
    if (walker === null) throw new Error('夹具里没有 Spica');

    // 引擎：绕开封锁边之后仍然可以走到 6
    expect(canMoveTo(state, walker, 6)).toBe(true);
    // 而"不带约束的最短路"正是那条被封的边
    expect(shortestPath(state.map.graph, 0, 6)).toEqual([0, 6]);

    // 界面按规则算出来的轨迹要绕路
    const path = createMovePathOf(state.map.graph, new Set([edgeKey(0, 6)]), state.characters)(
      0,
      6,
      walker.id,
    );
    expect(path.length).toBeGreaterThan(2);
    expect(isEdgeWalk(path)).toBe(true);
    for (let index = 1; index < path.length; index += 1) {
      expect(edgeKey(path[index - 1] as VertexId, path[index] as VertexId)).not.toBe(edgeKey(0, 6));
    }
  });
});
