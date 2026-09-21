import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
