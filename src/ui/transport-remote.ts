/**
 * 联机 transport：把服务端推来的快照接成和本地对局**同一个** `GameTransport`。
 *
 * 组件完全不知道自己在联机——照样只读 `view` / `legalActions`、只 `dispatch(action)`。
 * 服务端权威：客户端算不出任何伤害或位置，收到的都是已经算好的视图。
 *
 * 断线（或在浏览器里刷新）用 localStorage 里的 token 坐回原位；
 * 连接期间的重试也在这一层处理，界面只看见一份状态。
 */

import type { Action } from '../core/Action';
import type { GameEvent } from '../core/Event';
import type { PlayerId } from '../core/GameState';
import { latestEventsOf } from '../server/GameSession';
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type RoomSnapshot,
  type ServerMessage,
} from '../server/protocol';
import type { GameSnapshot, GameTransport, NewGameOptions } from './transport';

export type RemoteStatus = 'connecting' | 'waiting' | 'playing' | 'closed';

/**
 * 联机服务器的默认地址：**总是当前页面的同源 `/ws`**。
 *
 * 开发时 Vite 会把 `/ws` 代理到 `npm run server`；正式部署是服务端一个端口同时提供
 * 前端与 WebSocket。两种情况都不用配地址，跨机时把带 `?room=` 的链接发出去就行。
 * 需要连别的机器（比如服务端在另一台）时用 `?server=ws://...` 覆盖。
 */
export function defaultServerUrl(): string {
  if (typeof location === 'undefined') return 'ws://127.0.0.1:8787';
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return scheme + '://' + location.host + '/ws';
}

export interface RemoteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RemoteJoinOptions {
  /** `ws://host:port`（不要带路径）。 */
  readonly url: string;
  readonly roomId: string;
  /** 默认用 localStorage；测试里注入内存实现。 */
  readonly storage?: RemoteStorage;
  /** 应用层心跳间隔（毫秒）。 */
  readonly heartbeatMs?: number;
  /** 断线重连的间隔与次数。 */
  readonly retryMs?: number;
  readonly maxRetries?: number;
}

export interface RemoteJoin {
  /** 第一份快照到手后 resolve；之后这个 transport 一直有效（断线重连也复用它）。 */
  readonly ready: Promise<GameTransport>;
  readonly status: RemoteStatus;
  /** 对手是否在线（本地对局恒为 true）。 */
  readonly opponentOnline: boolean;
  /** 我坐哪一位；还没进房间时是 null。 */
  readonly seat: PlayerId | null;
  subscribe(listener: () => void): () => void;
  close(): void;
}

const DEFAULT_HEARTBEAT_MS = 20_000;
const DEFAULT_RETRY_MS = 2_000;
const DEFAULT_MAX_RETRIES = 10;

function tokenKey(roomId: string): string {
  return 'yumezu.room.' + roomId;
}

export function connectRemote(options: RemoteJoinOptions): RemoteJoin {
  const storage: RemoteStorage =
    options.storage ??
    (typeof localStorage === 'undefined'
      ? { getItem: () => null, setItem: () => undefined }
      : localStorage);
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  const listeners = new Set<() => void>();
  let socket: WebSocket | null = null;
  let status: RemoteStatus = 'connecting';
  let opponentOnline = false;
  let seat: PlayerId | null = null;
  let closedByUser = false;
  let retries = 0;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  /** 首次连接延迟一拍：StrictMode 会把 effect 跑两遍，这样第一遍能被干净地取消。 */
  let openTimer: ReturnType<typeof setTimeout> | null = null;

  /** 客户端自己的事件计数：0 = 刚连上，此时不播动画。 */
  let eventSeq = 0;
  let serverSeq: number | null = null;
  let lastEvents: readonly GameEvent[] = [];
  let uiSnapshot: GameSnapshot | null = null;

  let resolveReady: (transport: GameTransport) => void = () => undefined;
  const ready = new Promise<GameTransport>((resolvePromise) => {
    resolveReady = resolvePromise;
  });

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function setStatus(next: RemoteStatus): void {
    if (status === next) return;
    status = next;
    notify();
  }

  const transport: GameTransport = {
    getSnapshot(): GameSnapshot {
      // 注意：这个对象必须**保持不变**直到下一份快照——useSyncExternalStore 靠引用判断变化，
      // 每次新建的话 React 会以为状态一直在变，直接进入无限重渲染。
      if (uiSnapshot === null) throw new Error('联机对局还没收到第一份快照');
      return uiSnapshot;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(action: Action): void {
      // 不在房间里就当没点（界面只会在有快照之后出现）
      if (socket === null || socket.readyState !== 1) return;
      const message: ClientMessage = { type: 'action', action };
      socket.send(JSON.stringify(message));
    },
    setViewer(): void {
      // 联机时视角固定在自己这一边，切换视角没有意义（开发面板里的按钮会点空）
    },
    startNewGame(_options: NewGameOptions): void {
      // 开局由服务端在两人到齐时决定，客户端没有开新局的权力
    },
    undo(): void {
      // 悔棋只属于本地对局
    },
    loadRecord(): boolean {
      // 回放在服务端那份记录上做（见开发面板），客户端不接管对局
      return false;
    },
    replayStep(): void {},
    replayBack(): void {},
    stopReplay(): void {},
  };

  function handleSnapshot(next: RoomSnapshot): void {
    const firstSnapshot = serverSeq === null;
    const newAction = !firstSnapshot && next.eventSeq !== serverSeq;
    serverSeq = next.eventSeq;
    if (firstSnapshot) {
      // 刚连上：把当前局面摆出来就好，不要补播上一手的动画
      eventSeq = 0;
      lastEvents = [];
    } else if (newAction) {
      eventSeq += 1;
      // 事件从视图里取——视图已经过滤过会泄露手牌的内容
      lastEvents = latestEventsOf(next.view);
    }
    seat = next.seat;
    uiSnapshot = {
      view: next.view,
      legalActions: next.legalActions,
      finished: next.finished,
      stateHash: next.stateHash,
      viewer: next.seat,
      lastEvents,
      eventSeq,
      // 悔棋是本地便利功能，联机没有
      canUndo: false,
      replay: null,
      record: next.record,
    };
    notify();
  }

  function handleMessage(data: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(data) as ServerMessage;
    } catch {
      return;
    }
    switch (message.type) {
      case 'welcome':
        seat = message.seat;
        storage.setItem(tokenKey(options.roomId), message.token);
        setStatus('waiting');
        return;
      case 'waiting':
        setStatus('waiting');
        return;
      case 'snapshot':
        handleSnapshot(message.snapshot);
        setStatus('playing');
        resolveReady(transport);
        return;
      case 'presence':
        opponentOnline = message.opponentOnline;
        notify();
        return;
      case 'error':
        // 房间满、版本不符这类问题不该重试，直接摆出失败状态
        closedByUser = true;
        setStatus('closed');
        return;
      case 'pong':
        return;
      default:
        return;
    }
  }

  function scheduleRetry(): void {
    if (closedByUser || retries >= maxRetries) {
      setStatus('closed');
      return;
    }
    retries += 1;
    setStatus('connecting');
    setTimeout(open, retryMs);
  }

  function open(): void {
    if (closedByUser) return;
    const next = new WebSocket(options.url);
    socket = next;
    next.addEventListener('open', () => {
      retries = 0;
      const token = storage.getItem(tokenKey(options.roomId));
      const hello: ClientMessage = {
        type: 'hello',
        version: PROTOCOL_VERSION,
        roomId: options.roomId,
        token,
      };
      next.send(JSON.stringify(hello));
    });
    next.addEventListener('message', (event) => {
      handleMessage(String((event as MessageEvent).data));
    });
    next.addEventListener('close', () => {
      if (heartbeat !== null) clearInterval(heartbeat);
      heartbeat = null;
      if (closedByUser) return;
      // 断线：带着 token 重连，坐回原位
      scheduleRetry();
    });
    next.addEventListener('error', () => next.close());
    heartbeat = setInterval(() => {
      if (socket?.readyState === 1) {
        const ping: ClientMessage = { type: 'ping' };
        socket.send(JSON.stringify(ping));
      }
    }, heartbeatMs);
  }

  openTimer = setTimeout(() => {
    openTimer = null;
    open();
  }, 0);

  return {
    ready,
    get status() {
      return status;
    },
    get opponentOnline() {
      return opponentOnline;
    },
    get seat() {
      return seat;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close(): void {
      closedByUser = true;
      if (openTimer !== null) clearTimeout(openTimer);
      openTimer = null;
      if (heartbeat !== null) clearInterval(heartbeat);
      heartbeat = null;
      socket?.close();
      socket = null;
      setStatus('closed');
    },
  };
}
