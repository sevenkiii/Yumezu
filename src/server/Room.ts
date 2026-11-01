/**
 * 房间：谁坐在哪、是否在线、以及这一局的权威对局。
 *
 * 房间号由玩家自己定（谁先开谁建房），创建时确定 2 ~ 4 人的目标人数；
 * 满员后才开局，之后的玩家会被拒。
 * 凭据（token）存在浏览器里，断线回来带着它就能坐回原来的位置。
 */

import type { PlayerCount, PlayerId } from '../core/GameState';
import { PLAYER_IDS, normalizePlayerCount } from '../core/GameState';
import { createGameSession, type GameSession, type GameSessionOptions } from './GameSession';

export interface RoomSeat {
  readonly player: PlayerId;
  readonly token: string;
  online: boolean;
}

export interface Room {
  readonly id: string;
  /** 房间创建时确定的参战人数。 */
  readonly playerCount: PlayerCount;
  readonly seats: RoomSeat[];
  /** 目标人数到齐后由服务端开局；在此之前是 null。 */
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
  | { readonly ok: false; readonly code: 'ROOM_FULL' | 'ROOM_CONFIG' };

export interface RoomRegistryOptions {
  /** 生成重连凭据（测试里注入固定值，线上用随机串）。 */
  readonly newToken: () => string;
  /** 开局参数；目标人数到齐、真正开局时才调用一次。 */
  readonly newSessionOptions: (
    roomId: string,
    playerCount: PlayerCount,
  ) => Omit<GameSessionOptions, 'roomId' | 'playerCount'>;
}

export interface RoomRegistry {
  join(roomId: string, token: string | null, playerCount?: number): JoinResult;
  get(roomId: string): Room | undefined;
  setOnline(roomId: string, player: PlayerId, online: boolean): Room | undefined;
  /** 所有座位都离线的房间直接丢掉。 */
  prune(): void;
  /** 当前房间数（测试与调试用）。 */
  size(): number;
}

export function createRoomRegistry(options: RoomRegistryOptions): RoomRegistry {
  const rooms = new Map<string, Room>();

  function seatOf(room: Room, token: string | null): RoomSeat | undefined {
    if (token === null) return undefined;
    return room.seats.find((seat) => seat.token === token);
  }

  return {
    join(roomId: string, token: string | null, requestedPlayerCount?: number): JoinResult {
      const playerCount = normalizePlayerCount(requestedPlayerCount);
      const existing = rooms.get(roomId);
      if (existing !== undefined) {
        const returning = seatOf(existing, token);
        if (returning !== undefined) {
          returning.online = true;
          return {
            ok: true,
            room: existing,
            seat: returning.player,
            token: returning.token,
            reconnected: true,
          };
        }
      }
      if (existing !== undefined && existing.playerCount !== playerCount) {
        return { ok: false, code: 'ROOM_CONFIG' };
      }
      const room: Room = existing ?? {
        id: roomId,
        playerCount,
        seats: [],
        session: null,
      };
      if (existing === undefined) rooms.set(roomId, room);

      if (room.seats.length >= room.playerCount) return { ok: false, code: 'ROOM_FULL' };
      const player = PLAYER_IDS[room.seats.length] as PlayerId;
      const fresh: RoomSeat = { player, token: options.newToken(), online: true };
      room.seats.push(fresh);
      // 目标人数到齐才开局（开局由核心随机部署，没有部署交换，见 RULES.md §3）
      if (room.seats.length === room.playerCount && room.session === null) {
        room.session = createGameSession({
          roomId,
          playerCount: room.playerCount,
          ...options.newSessionOptions(roomId, room.playerCount),
        });
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
