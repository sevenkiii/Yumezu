/**
 * 权威对局 + 房间：不碰网络，直接用内存跑。
 * 重点是三条：**只有轮到的人能行动**、**对手手牌不可见**、**重连能坐回原位**。
 */

import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import type { PlayerId } from '../src/core/GameState';
import { createRoomRegistry, type RoomRegistry } from '../src/server/Room';

function registry(maxTurns: number | null = 40): RoomRegistry {
  let counter = 0;
  return createRoomRegistry({
    newToken: () => 'token-' + ++counter,
    newSessionOptions: (roomId) => ({
      mapSeed: roomId + '-map',
      gameSeed: roomId + '-game',
      maxTurns,
    }),
  });
}

function joinTwo(rooms: RoomRegistry, roomId = 'room-1') {
  const first = rooms.join(roomId, null);
  const second = rooms.join(roomId, null);
  if (!first.ok || !second.ok) throw new Error('加入失败');
  const room = first.room;
  const session = room.session;
  if (session === null) throw new Error('两人到齐就该开局');
  return { room, session, first, second };
}

/** 现在轮到谁。 */
function actingPlayer(session: ReturnType<typeof joinTwo>['session']): PlayerId {
  return session.snapshotFor('P1').view.currentPlayer;
}

describe('房间与权威对局', () => {
  it('两人各坐一位，第三个人被挡在门外', () => {
    const rooms = registry();
    const { first, second, room } = joinTwo(rooms);
    expect(first.seat).toBe('P1');
    expect(second.seat).toBe('P2');
    expect(first.reconnected).toBe(false);
    expect(room.session).not.toBeNull();
    expect(rooms.join('room-1', null)).toEqual({ ok: false, code: 'ROOM_FULL' });
    expect(rooms.join('room-2', null).ok).toBe(true);
  });

  it('只有轮到的人能提交行动', () => {
    const { session } = joinTwo(registry());
    const acting = actingPlayer(session);
    const waiting: PlayerId = acting === 'P1' ? 'P2' : 'P1';
    const action = session.snapshotFor(acting).legalActions[0] as Action;

    expect(session.submit(waiting, action)).toEqual({ ok: false, code: 'NOT_YOUR_TURN' });
    expect(session.submit(acting, action)).toEqual({ ok: true });
  });

  it('非行动方拿不到合法行动（否则会泄露手牌）', () => {
    const { session } = joinTwo(registry());
    const acting = actingPlayer(session);
    const waiting: PlayerId = acting === 'P1' ? 'P2' : 'P1';
    expect(session.snapshotFor(acting).legalActions.length).toBeGreaterThan(0);
    expect(session.snapshotFor(waiting).legalActions).toEqual([]);
  });

  it('视图里看不到对手的手牌与抽牌记录', () => {
    const { session } = joinTwo(registry());
    const acting = actingPlayer(session);
    const action = session.snapshotFor(acting).legalActions[0] as Action;
    session.submit(acting, action);

    // 走完一手之后，轮到的那位会抽牌——这条记录只能自己看得到
    for (const seat of ['P1', 'P2'] as PlayerId[]) {
      const view = session.snapshotFor(seat).view;
      expect(view.viewer).toBe(seat);
      expect(view.hand.every((card) => typeof card.cardId === 'string')).toBe(true);
      for (const turn of view.recentTurns) {
        for (const event of turn.events) {
          if (event.type === 'CARD_DRAWN' || event.type === 'CARD_DISCARDED') {
            expect(event.player).toBe(seat);
          }
        }
      }
    }
  });

  it('凭据能坐回原位，看到的局面和断开前一致', () => {
    const rooms = registry();
    const { session, first } = joinTwo(rooms);
    const acting = actingPlayer(session);
    session.submit(acting, session.snapshotFor(acting).legalActions[0] as Action);
    const before = session.snapshotFor(first.seat);

    rooms.setOnline('room-1', first.seat, false);
    const again = rooms.join('room-1', first.token);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.reconnected).toBe(true);
    expect(again.seat).toBe(first.seat);
    expect(again.room.session?.snapshotFor(first.seat).stateHash).toBe(before.stateHash);
  });

  it('两个座位都离线的房间会被清理', () => {
    const rooms = registry();
    const { first, second } = joinTwo(rooms);
    rooms.setOnline('room-1', first.seat, false);
    rooms.setOnline('room-1', second.seat, false);
    expect(rooms.size()).toBe(1);
    rooms.prune();
    expect(rooms.size()).toBe(0);
  });

  it('一整局能在服务端打完，两边的状态哈希一致', () => {
    const { session } = joinTwo(registry(30));
    let guard = 0;
    while (!session.finished() && guard < 400) {
      const acting = actingPlayer(session);
      const action = session.snapshotFor(acting).legalActions[0];
      if (action === undefined) break;
      expect(session.submit(acting, action)).toEqual({ ok: true });
      guard += 1;
    }
    expect(session.finished()).toBe(true);
    const p1 = session.snapshotFor('P1');
    const p2 = session.snapshotFor('P2');
    expect(p1.finished).toBe(true);
    expect(p1.stateHash).toBe(p2.stateHash);
    expect(p1.legalActions).toEqual([]);
    expect(p2.legalActions).toEqual([]);
  });
});
