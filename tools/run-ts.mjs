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
