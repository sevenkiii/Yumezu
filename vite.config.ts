import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const DEV_GAME_SERVER_HOST = '127.0.0.1';
const DEV_GAME_SERVER_PORT = 8787;
const EMBEDDED_SERVER_DISABLED = 'YUMEZU_DISABLE_EMBEDDED_SERVER';

/** 端口已经有人监听时不重复启动，兼容手动 `npm run server`。 */
function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (open: boolean): void => {
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function waitForPort(host: string, port: number, timeoutMs = 8_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(host, port)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return false;
}

function embeddedGameServer(): Plugin {
  return {
    name: 'yumezu-embedded-game-server',
    async configureServer(server) {
      // Vitest 也会创建 Vite server，但测试不应该拉起常驻联机进程。
      if (process.env.VITEST !== undefined || process.env[EMBEDDED_SERVER_DISABLED] === '1') {
        return;
      }
      if (await isPortOpen(DEV_GAME_SERVER_HOST, DEV_GAME_SERVER_PORT)) {
        server.config.logger.info(
          `[yumezu] 复用已运行的联机服务 ws://${DEV_GAME_SERVER_HOST}:${DEV_GAME_SERVER_PORT}`,
        );
        return;
      }

      const projectRoot = fileURLToPath(new URL('.', import.meta.url));
      const child = spawn(
        process.execPath,
        [
          resolve(projectRoot, 'tools/run-ts.mjs'),
          'src/server/main.ts',
          '--host',
          DEV_GAME_SERVER_HOST,
          '--port',
          String(DEV_GAME_SERVER_PORT),
          '--no-static',
        ],
        {
          cwd: projectRoot,
          env: { ...process.env, [EMBEDDED_SERVER_DISABLED]: '1' },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        },
      );
      child.stdout?.on('data', (chunk) => {
        server.config.logger.info(String(chunk).trim());
      });
      child.stderr?.on('data', (chunk) => {
        server.config.logger.warn(String(chunk).trim());
      });

      if (!(await waitForPort(DEV_GAME_SERVER_HOST, DEV_GAME_SERVER_PORT))) {
        child.kill();
        server.config.logger.warn(
          '[yumezu] 联机服务启动失败，网页仍可单机游玩；可手动运行 npm run server 查看错误。',
        );
        return;
      }

      server.config.logger.info(
        `[yumezu] 联机服务已随开发服务器启动 ws://${DEV_GAME_SERVER_HOST}:${DEV_GAME_SERVER_PORT}`,
      );
      server.httpServer?.once('close', () => {
        child.kill();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), embeddedGameServer()],
  server: {
    // 开发时把联机的 WebSocket 代理到 `npm run server`（默认 8787），
    // 这样页面永远连"自己这个源"的 /ws：开发与部署同一套地址，邀请链接也不用带参数。
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8787',
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Phase 1 的测试全部针对纯核心逻辑，因此默认使用 node 环境。
    // 后续出现 React 组件测试时，可在对应文件顶部用 `// @vitest-environment jsdom` 覆盖。
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.{ts,tsx}'],
    // 自动对局模拟需要跑完整局，默认 5s 超时不够
    testTimeout: 20000,
    passWithNoTests: true,
  },
});
