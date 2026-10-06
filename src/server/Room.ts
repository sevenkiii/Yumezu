/**
 * 房间：谁坐在哪、是否在线、以及这一局的权威对局。
 *
 * 房间号由玩家自己定（谁先开谁建房），同一个房间最多两人：第三个人会被拒。
 * 凭据（token）存在浏览器里，断线回来带着它就能坐回原来的位置。
 */

import type { PlayerId } from '../core/GameState';
import { createGameSession, type GameSession, type GameSessionOptions } from './GameSession';

export interface RoomSeat {
  readonly player: PlayerId;
  readonly token: string;
  online: boolean;
}

export interface Room {
  readonly id: string;
  readonly seats: RoomSeat[];
  /** 两人到齐后由服务端开局；在此之前是 null。 */
  session: GameSession | null;
}

export type JoinResult =
  | {
      readonly ok: true;
      readonly room: Room;
      readonly seat: PlayerId;
      readonly token: string;
      readonly reconnected: boolean;
    }
  | { readonly ok: false; readonly code: 'ROOM_FULL' };

export interface RoomRegistryOptions {
  /** 生成重连凭据（测试里注入固定值，线上用随机串）。 */
  readonly newToken: () => string;
  /** 开局参数；两人到齐、真正开局时才调用一次。 */
  readonly newSessionOptions: (roomId: string) => Omit<GameSessionOptions, 'roomId'>;
}

export interface RoomRegistry {
  join(roomId: string, token: string | null): JoinResult;
  get(roomId: string): Room | undefined;
  setOnline(roomId: string, player: PlayerId, online: boolean): Room | undefined;
  /** 两个座位都离线的房间直接丢掉。 */
  prune(): void;
  /** 当前房间数（测试与调试用）。 */
  size(): number;
}

const SEATS: readonly PlayerId[] = ['P1', 'P2'];

export function createRoomRegistry(options: RoomRegistryOptions): RoomRegistry {
  const rooms = new Map<string, Room>();

  function seatOf(room: Room, token: string | null): RoomSeat | undefined {
    if (token === null) return undefined;
    return room.seats.find((seat) => seat.token === token);
  }

  return {
    join(roomId: string, token: string | null): JoinResult {
      const existing = rooms.get(roomId);
      const room: Room = existing ?? { id: roomId, seats: [], session: null };
      if (existing === undefined) rooms.set(roomId, room);

      // 老玩家回来：认凭据，坐原位
      const seat = seatOf(room, token);
      if (seat !== undefined) {
        seat.online = true;
        return { ok: true, room, seat: seat.player, token: seat.token, reconnected: true };
      }

      if (room.seats.length >= 2) return { ok: false, code: 'ROOM_FULL' };
      const player = SEATS[room.seats.length] as PlayerId;
      const fresh: RoomSeat = { player, token: options.newToken(), online: true };
      room.seats.push(fresh);
      // 两人到齐才开局（开局由核心随机部署，没有部署交换，见 RULES.md §3）
      if (room.seats.length === 2 && room.session === null) {
        room.session = createGameSession({ roomId, ...options.newSessionOptions(roomId) });
      }
      return { ok: true, room, seat: player, token: fresh.token, reconnected: false };
    },

    get(roomId: string): Room | undefined {
      return rooms.get(roomId);
    },

    setOnline(roomId: string, player: PlayerId, online: boolean): Room | undefined {
      const room = rooms.get(roomId);
      if (room === undefined) return undefined;
      const seat = room.seats.find((item) => item.player === player);
      if (seat !== undefined) seat.online = online;
      return room;
    },

    prune(): void {
      for (const [roomId, room] of rooms) {
        if (room.seats.length > 0 && room.seats.every((seat) => !seat.online)) rooms.delete(roomId);
      }
    },

    size: () => rooms.size,
  };
}
