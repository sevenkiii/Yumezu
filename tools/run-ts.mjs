#!/usr/bin/env node
/**
 * 用 Vite 的 SSR 加载器运行 TypeScript 脚本，避免引入额外的 TS 运行时依赖。
 *
 * 用法：
 *   node tools/run-ts.mjs test/simulate.ts --games 200
 *   npm run simulate -- --games 200
 *
 * 被运行的脚本必须导出 main(argv)。
 */

import { createServer } from 'vite';

const [entry, ...args] = process.argv.slice(2);

if (entry === undefined) {
  process.stderr.write('用法：node tools/run-ts.mjs <入口.ts> [参数…]\n');
  process.exit(1);
}

// run-ts 是脚本运行器，不是 `vite` 开发服务器。禁止加载开发模式里
// “随 Vite 自动启动联机子进程”的插件，否则 `npm run server` 会自己抢占 8787。
process.env.YUMEZU_DISABLE_EMBEDDED_SERVER = '1';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const module = await server.ssrLoadModule('/' + entry);
  if (typeof module.main !== 'function') {
    throw new Error(entry + ' 必须导出 main(argv) 函数');
  }
  await module.main(args);
  await server.close();
  process.exit(0);
} catch (error) {
  await server.close();
  process.stderr.write((error instanceof Error ? error.stack : String(error)) + '\n');
  process.exit(1);
}
