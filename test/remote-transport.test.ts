/**
 * 联机 transport：起一个真的服务端，让两个客户端连上去打几手。
 * 这一层测的是"界面拿到的快照"——和本地对局同一种形状，且拿不到对手的手牌。
 */

import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import type { PlayerId } from '../src/core/GameState';
import { createGameServer } from '../src/server/server';
import type { GameTransport } from '../src/ui/transport';
import { connectRemote, type RemoteStorage } from '../src/ui/transport-remote';

function memoryStorage(): RemoteStorage & { dump(): Record<string, string> } {
  const values: Record<string, string> = {};
  return {
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
    dump: () => values,
  };
}

/** 等到某件事发生（联机是异步的）。 */
async function waitFor(check: () => boolean, label: string, timeoutMs = 5000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error('超时：' + label);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function setup() {
  const server = createGameServer({
    port: 0,
    host: '127.0.0.1',
    staticDir: null,
    heartbeatMs: 5_000,
  });
  const port = await server.listening;
  const url = 'ws://127.0.0.1:' + port;
  const hostStorage = memoryStorage();
  const guestStorage = memoryStorage();
  const host = connectRemote({ url, roomId: 'test-room', storage: hostStorage });
  const guest = connectRemote({ url, roomId: 'test-room', storage: guestStorage });
  const hostTransport = await host.ready;
  const guestTransport = await guest.ready;
  return { server, url, host, guest, hostTransport, guestTransport, hostStorage, guestStorage };
}

/** 现在轮到谁，就返回谁的 transport。 */
function actingTransport(a: GameTransport, b: GameTransport): GameTransport {
  return a.getSnapshot().view.currentPlayer === a.getSnapshot().view.viewer ? a : b;
}

describe('联机 transport', () => {
  it('两名玩家拿到同一局面，各自只看得见自己的合法行动', async () => {
    const { server, host, guest, hostTransport, guestTransport } = await setup();
    const a = hostTransport.getSnapshot();
    const b = guestTransport.getSnapshot();

    expect(a.view.viewer).not.toBe(b.view.viewer);
    expect(a.stateHash).toBe(b.stateHash);
    expect(a.finished).toBe(false);
    // 悔棋在联机里不可用
    expect(a.canUndo).toBe(false);

    const acting = actingTransport(hostTransport, guestTransport);
    const waiting = acting === hostTransport ? guestTransport : hostTransport;
    expect(acting.getSnapshot().legalActions.length).toBeGreaterThan(0);
    expect(waiting.getSnapshot().legalActions).toEqual([]);
    expect(typeof waiting.getSnapshot().view.opponentHandCount).toBe('number');

    host.close();
    guest.close();
    await server.close();
  });

  it('一手行动会同时推给两边，且两边哈希一致', async () => {
    const { server, host, guest, hostTransport, guestTransport } = await setup();
    const acting = actingTransport(hostTransport, guestTransport);
    const other = acting === hostTransport ? guestTransport : hostTransport;
    const action = acting.getSnapshot().legalActions[0] as Action;
    const before = acting.getSnapshot().stateHash;

    acting.dispatch(action);
    await waitFor(() => other.getSnapshot().stateHash !== before, '对手收到新快照');

    expect(acting.getSnapshot().stateHash).toBe(other.getSnapshot().stateHash);
    expect(acting.getSnapshot().eventSeq).toBeGreaterThan(0);
    // 行动完就轮到对方了：刚才行动的那位现在不该有合法行动
    expect(acting.getSnapshot().legalActions).toEqual([]);
    expect(other.getSnapshot().legalActions.length).toBeGreaterThan(0);

    host.close();
    guest.close();
    await server.close();
  });

  it('刷新页面（带着 token 重连）能坐回原位、看到同一局面', async () => {
    const { server, url, host, guest, hostTransport, hostStorage } = await setup();
    const seat = host.seat as PlayerId;
    const hash = hostTransport.getSnapshot().stateHash;

    // 模拟刷新：老连接断掉，新连接带上存在 storage 里的 token
    host.close();
    const again = connectRemote({ url, roomId: 'test-room', storage: hostStorage });
    const againTransport = await again.ready;

    expect(again.seat).toBe(seat);
    expect(againTransport.getSnapshot().stateHash).toBe(hash);

    again.close();
    guest.close();
    await server.close();
  });
});
