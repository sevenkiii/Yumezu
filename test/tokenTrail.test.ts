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
  buildTokenLunges,
  buildTokenTrails,
  createMovePathOf,
  type TrailPoint,
  type TokenTrailContext,
} from '../src/ui/tokenTrail';
import { createBattleState } from './support/fixtures';

const ALICE = 'P1:Mikage' as CharacterId;
const BOB = 'P2:Lily' as CharacterId;
const CAROL = 'P2:Urara' as CharacterId;

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

function damaged(
  source: CharacterId,
  target: CharacterId,
  kind: 'ATTACK' | 'TRAP' = 'ATTACK',
): GameEvent {
  return {
    type: 'DAMAGED',
    targetId: target,
    amount: 2,
    hpAfter: 8,
    source: {
      kind,
      sourceCharacterId: kind === 'TRAP' ? null : source,
      sourcePlayerId: 'P1',
    },
  };
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
  it('MOVED 沿图上的逐跳路径走；原地不动不产生轨迹', () => {
    const { from, to, path } = findDistantPair();
    const trails = buildTokenTrails([moved(ALICE, from, to)], context(new Map()));

    expect(trails).toHaveLength(1);
    expect(trails[0]?.characterId).toBe(ALICE);
    expect(trails[0]?.points).toEqual(path.map((vertex) => positions.get(vertex)));
    expect(trails[0]?.points.length).toBeGreaterThanOrEqual(3);

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

  it('SWAP 对穿；缺坐标退化成直线；无关事件不产生轨迹', () => {
    const { from, to, path } = findDistantPair();
    // 换位之后：ALICE 站在 to，BOB 站在 from
    const after = new Map<CharacterId, VertexId>([
      [ALICE, to],
      [BOB, from],
    ]);
    const trails = buildTokenTrails([{ type: 'SWAPPED', a: ALICE, b: BOB }], context(after));
    const byId = new Map(trails.map((trail) => [trail.characterId, trail.points]));
    expect(byId.get(ALICE)).toEqual([positions.get(from), positions.get(to)]);
    expect(byId.get(BOB)).toEqual([positions.get(to), positions.get(from)]);

    // 中间节点缺坐标：退化成起点 → 终点的直线，而不是丢掉整条轨迹
    const partial = new Map(positions);
    for (const vertex of path.slice(1, -1)) partial.delete(vertex);
    const straight = buildTokenTrails([moved(ALICE, from, to)], {
      positions: partial,
      positionOfCharacter: new Map(),
      pathOfMove,
    });
    expect(straight[0]?.points).toEqual([positions.get(from), positions.get(to)]);

    // 阵亡 / 伤害这类与位移无关的事件不产生轨迹
    const unrelated: GameEvent[] = [
      { type: 'CHARACTER_DIED', characterId: ALICE },
      damaged(ALICE, BOB),
    ];
    expect(buildTokenTrails(unrelated, context(new Map()))).toEqual([]);
  });
});

describe('buildTokenLunges：只有单体伤害才撞过去', () => {
  const positionOfCharacter = new Map<CharacterId, VertexId>([
    [ALICE, 0],
    [BOB, 24],
    [CAROL, 29],
  ]);
  const lungeContext = { positions, positionOfCharacter };

  it('单体伤害撞一次，方向是"出手方 → 目标"', () => {
    const lunges = buildTokenLunges([damaged(ALICE, BOB)], lungeContext);
    expect(lunges).toHaveLength(1);
    expect(lunges[0]?.characterId).toBe(ALICE);
    expect(lunges[0]?.targetId).toBe(BOB);
    expect(lunges[0]?.from).toEqual(positions.get(0));
    expect(lunges[0]?.to).toEqual(positions.get(24));
  });

  it('AOE、多段、陷阱、位置缺失都不该乱撞', () => {
    // AOE：同一出手方打了两个目标
    expect(buildTokenLunges([damaged(ALICE, BOB), damaged(ALICE, CAROL)], lungeContext)).toEqual(
      [],
    );

    // 同一目标挨了两下（单体多段）→ 只撞一次
    const twice = buildTokenLunges([damaged(ALICE, BOB), damaged(ALICE, BOB)], lungeContext);
    expect(twice).toHaveLength(1);
    expect(twice[0]?.targetId).toBe(BOB);

    // 陷阱没有出手角色
    expect(buildTokenLunges([damaged(ALICE, BOB, 'TRAP')], lungeContext)).toEqual([]);

    // 出手方或目标的位置拿不到
    const empty = { positions, positionOfCharacter: new Map<CharacterId, VertexId>() };
    expect(buildTokenLunges([damaged(ALICE, BOB)], empty)).toEqual([]);
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

  it('绕开被封锁的边（引擎仍允许走到对面，只是轨迹不能穿封锁边）', () => {
    const path = createMovePathOf(PHASE1_MAP, new Set([edgeKey(0, 6)]), [mover])(0, 6, mover.id);

    // 不带约束时最短路就是这条被封的边；带上约束后必须绕路
    expect(shortestPath(PHASE1_MAP, 0, 6)).toEqual([0, 6]);
    expect(path[0]).toBe(0);
    expect(path[path.length - 1]).toBe(6);
    expect(path.length).toBeGreaterThan(2);
    expect(isEdgeWalk(path)).toBe(true);
    for (let index = 1; index < path.length; index += 1) {
      expect(edgeKey(path[index - 1] as VertexId, path[index] as VertexId)).not.toBe(edgeKey(0, 6));
    }

    // 真实局面：Spica 移动范围 3，直连边被封后绕路仍够得着，轨迹与引擎结论一致
    const state = createBattleState({
      p1: ['Spica'],
      p2: ['Lily'],
      positions: { 'P1:Spica': 0, 'P2:Lily': 22 },
      currentPlayer: 'P1',
    });
    state.map.blockedEdges.push({ edge: edgeKey(0, 6), owner: 'P2', expiresAtTurnIndex: 99 });
    const walker = findCharacter(state, 'P1:Spica');
    if (walker === null) throw new Error('夹具里没有 Spica');
    expect(canMoveTo(state, walker, 6)).toBe(true);

    const real = createMovePathOf(state.map.graph, new Set([edgeKey(0, 6)]), state.characters)(
      0,
      6,
      walker.id,
    );
    expect(real.length).toBeGreaterThan(2);
    expect(isEdgeWalk(real)).toBe(true);
  });

  it('不穿过敌方角色、可以穿过友方；走不通时返回空数组', () => {
    const enemy = createCharacter('P2', 'Lily', 1);
    const ally = createCharacter('P1', 'Nana', 1);

    const aroundEnemy = createMovePathOf(PHASE1_MAP, new Set(), [mover, enemy])(0, 2, mover.id);
    expect(aroundEnemy).not.toContain(1);
    expect(aroundEnemy[0]).toBe(0);
    expect(aroundEnemy[aroundEnemy.length - 1]).toBe(2);
    expect(isEdgeWalk(aroundEnemy)).toBe(true);

    const throughAlly = createMovePathOf(PHASE1_MAP, new Set(), [mover, ally])(0, 2, mover.id);
    expect(throughAlly).toEqual([0, 1, 2]);

    // 两侧都被封：返回空数组，而不是画一条穿墙的直线
    const blocked = new Set([edgeKey(0, 1), edgeKey(0, 6)]);
    expect(createMovePathOf(PHASE1_MAP, blocked, [mover])(0, 7, mover.id)).toEqual([]);
  });
});
