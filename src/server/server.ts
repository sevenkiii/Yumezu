/**
 * 联机服务端：一个进程、一个端口，同时提供
 *  - 静态前端（`npm run build` 的 `dist/`，没有就只开联机）
 *  - WebSocket 对局（`ws://<host>:<port>`）
 *
 * 权威逻辑都在 `GameSession` / `Room` 里，这里只做编解码、广播与心跳。
 */

import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';

import { WebSocketServer, type WebSocket } from 'ws';

import { createRoomRegistry, type Room, type RoomRegistry } from './Room';
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type RoomSnapshot,
  type ServerErrorCode,
  type ServerMessage,
} from './protocol';

export interface GameServerOptions {
  readonly port: number;
  /** 0.0.0.0 = 局域网/公网都能连；127.0.0.1 = 只本机。 */
  readonly host: string;
  /** 前端构建产物目录；给 null 就只跑联机服务。 */
  readonly staticDir?: string | null;
  /** 心跳间隔（毫秒）。 */
  readonly heartbeatMs?: number;
}

export interface GameServer {
  /** 关掉服务（测试用）。 */
  close(): Promise<void>;
  readonly registry: RoomRegistry;
  /** 真正监听的端口（传 0 让系统分配时用它拿结果）。 */
  readonly listening: Promise<number>;
}

/** 每个连接记着自己坐在哪个房间的哪个位置。 */
interface Connection {
  readonly socket: WebSocket;
  roomId: string | null;
  seat: 'P1' | 'P2' | null;
  alive: boolean;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

export function createGameServer(options: GameServerOptions): GameServer {
  const registry = createRoomRegistry({
    newToken: () => randomUUID(),
    newSessionOptions: (roomId) => ({
      mapSeed: roomId + '-' + randomUUID().slice(0, 8),
      gameSeed: 'game-' + randomUUID().slice(0, 8),
      maxTurns: null,
    }),
  });

  const connections = new Map<WebSocket, Connection>();
  const staticDir = options.staticDir === null ? null : resolve(options.staticDir ?? 'dist');

  const http: Server = createServer((request, response) => {
    serveStatic(request, response, staticDir);
  });
  const sockets = new WebSocketServer({ server: http });

  function send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  }

  function sendError(socket: WebSocket, code: ServerErrorCode, message: string): void {
    send(socket, { type: 'error', code, message });
  }

  /** 把房间里的两份快照分别发下去。 */
  function broadcast(room: Room): void {
    const session = room.session;
    if (session === null) return;
    const snapshots = new Map<'P1' | 'P2', RoomSnapshot>([
      ['P1', session.snapshotFor('P1')],
      ['P2', session.snapshotFor('P2')],
    ]);
    for (const connection of connections.values()) {
      if (connection.roomId !== room.id || connection.seat === null) continue;
      const snapshot = snapshots.get(connection.seat);
      if (snapshot !== undefined) send(connection.socket, { type: 'snapshot', snapshot });
    }
  }

  function broadcastPresence(room: Room): void {
    for (const connection of connections.values()) {
      if (connection.roomId !== room.id || connection.seat === null) continue;
      const opponent = room.seats.find((seat) => seat.player !== connection.seat);
      send(connection.socket, { type: 'presence', opponentOnline: opponent?.online ?? false });
    }
  }

  function handleHello(
    socket: WebSocket,
    message: Extract<ClientMessage, { type: 'hello' }>,
  ): void {
    if (message.version !== PROTOCOL_VERSION) {
      sendError(socket, 'BAD_VERSION', '协议版本不一致，请刷新页面');
      return;
    }
    const roomId = message.roomId.trim();
    if (roomId === '') {
      sendError(socket, 'BAD_MESSAGE', '房间号不能为空');
      return;
    }
    const result = registry.join(roomId, message.token);
    if (!result.ok) {
      sendError(socket, 'ROOM_FULL', '这个房间已经满了（最多两人）');
      return;
    }
    const connection = connections.get(socket);
    if (connection !== undefined) {
      connection.roomId = roomId;
      connection.seat = result.seat;
    }
    send(socket, {
      type: 'welcome',
      roomId,
      seat: result.seat,
      token: result.token,
      reconnected: result.reconnected,
    });

    const room = result.room;
    if (room.session === null) {
      send(socket, { type: 'waiting', roomId });
      return;
    }
    // 到齐了：两份快照都发一遍（第二个人进来时，先来的那位也要收到开局画面）
    broadcast(room);
    broadcastPresence(room);
  }

  function handleAction(
    socket: WebSocket,
    message: Extract<ClientMessage, { type: 'action' }>,
  ): void {
    const connection = connections.get(socket);
    if (connection === undefined || connection.roomId === null || connection.seat === null) {
      sendError(socket, 'BAD_MESSAGE', '还没加入房间');
      return;
    }
    const room = registry.get(connection.roomId);
    const session = room?.session ?? null;
    if (room === null || room === undefined || session === null) {
      sendError(socket, 'BAD_MESSAGE', '房间还没开始');
      return;
    }
    const result = session.submit(connection.seat, message.action);
    if (!result.ok) {
      sendError(socket, result.code, describeSubmitError(result.code));
      return;
    }
    broadcast(room);
  }

  function handleMessage(socket: WebSocket, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendError(socket, 'BAD_MESSAGE', '看不懂的消息');
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      sendError(socket, 'BAD_MESSAGE', '看不懂的消息');
      return;
    }
    const message = parsed as ClientMessage;
    switch (message.type) {
      case 'hello':
        handleHello(socket, message);
        return;
      case 'action':
        handleAction(socket, message);
        return;
      case 'ping':
        send(socket, { type: 'pong' });
        return;
      default:
        sendError(socket, 'BAD_MESSAGE', '看不懂的消息');
    }
  }

  sockets.on('connection', (socket: WebSocket) => {
    connections.set(socket, { socket, roomId: null, seat: null, alive: true });
    socket.on('pong', () => {
      const connection = connections.get(socket);
      if (connection !== undefined) connection.alive = true;
    });
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      handleMessage(socket, data.toString());
    });
    socket.on('close', () => {
      const connection = connections.get(socket);
      connections.delete(socket);
      if (connection === undefined || connection.roomId === null || connection.seat === null)
        return;
      const room = registry.setOnline(connection.roomId, connection.seat, false);
      if (room !== undefined) broadcastPresence(room);
      registry.prune();
    });
    socket.on('error', () => socket.terminate());
  });

  // 心跳：客户端不回 pong 就断开，免得留下僵尸房间
  const heartbeatMs = options.heartbeatMs ?? 30_000;
  const heartbeat = setInterval(() => {
    for (const connection of connections.values()) {
      if (!connection.alive) {
        connection.socket.terminate();
        continue;
      }
      connection.alive = false;
      connection.socket.ping();
    }
  }, heartbeatMs);

  http.listen(options.port, options.host);

  const listening = new Promise<number>((resolveListening) => {
    if (http.listening) {
      resolveListening((http.address() as AddressInfo).port);
      return;
    }
    http.once('listening', () => resolveListening((http.address() as AddressInfo).port));
  });

  return {
    registry,
    listening,
    close(): Promise<void> {
      clearInterval(heartbeat);
      for (const connection of connections.values()) connection.socket.terminate();
      return new Promise((resolveClose) => {
        sockets.close(() => http.close(() => resolveClose()));
      });
    },
  };
}

function describeSubmitError(code: 'NOT_YOUR_TURN' | 'ILLEGAL_ACTION' | 'FINISHED'): string {
  if (code === 'NOT_YOUR_TURN') return '还没轮到你';
  if (code === 'FINISHED') return '这一局已经结束了';
  return '这个行动不合法';
}

/** 极简静态托管：找不到文件就回 index.html（单页应用）。 */
function serveStatic(
  request: IncomingMessage,
  response: ServerResponse,
  staticDir: string | null,
): void {
  if (staticDir === null || !existsSync(staticDir)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('这个进程只提供联机服务（没有前端产物）');
    return;
  }
  const url = request.url ?? '/';
  const pathname = decodeURIComponent(url.split('?')[0] ?? '/');
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(staticDir, safe === '/' ? 'index.html' : safe);
  if (!filePath.startsWith(staticDir)) filePath = join(staticDir, 'index.html');
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(staticDir, 'index.html');
  }
  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}
