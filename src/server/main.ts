/**
 * 联机服务端入口。
 *
 * 用法：
 *   npm run server                    默认 0.0.0.0:8787，顺带托管 dist/
 *   npm run server -- --port 9000
 *   npm run server -- --host 127.0.0.1 --no-static
 *
 * 监听 0.0.0.0 时，局域网/公网里别人直接访问
 *   http://<你的地址>:<port>/?room=房间号
 * 就能一起玩（前端与 WebSocket 同一个端口）。
 */

import { createGameServer } from './server';

export interface ServerCliOptions {
  readonly port: number;
  readonly host: string;
  readonly staticDir: string | null;
}

/** 解析命令行参数（也导出给测试用）。 */
export function parseServerArgs(argv: readonly string[]): ServerCliOptions {
  let port = 8787;
  let host = '0.0.0.0';
  let staticDir: string | null = 'dist';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (arg === '--no-static') {
      staticDir = null;
      continue;
    }
    const next = argv[index + 1];
    if (arg === '--port' && next !== undefined) {
      port = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (arg === '--host' && next !== undefined) {
      host = next;
      index += 1;
      continue;
    }
    if (arg === '--static' && next !== undefined) {
      staticDir = next;
      index += 1;
    }
  }
  return { port, host, staticDir };
}

export async function main(argv: readonly string[]): Promise<void> {
  const options = parseServerArgs(argv);
  const server = createGameServer(options);
  const shown = options.host === '0.0.0.0' ? 'localhost' : options.host;
  process.stdout.write(
    '夢図 联机服务已启动\n' +
      '  本机：http://' +
      shown +
      ':' +
      options.port +
      '/?room=demo\n' +
      '  联机：把上面的 localhost 换成你的局域网/公网地址发给对手（房间号要一样）\n' +
      (options.staticDir === null ? '  （未托管前端，只提供联机服务）\n' : ''),
  );
  // 一直跑到进程被杀（Ctrl+C）；不要 return，否则 run-ts 会跟着退出
  await new Promise<void>((resolveShutdown) => {
    const shutdown = (): void => {
      void server.close().then(() => resolveShutdown());
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
