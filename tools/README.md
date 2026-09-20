# tools — 开发脚本

| 文件 | 职责 |
|---|---|
| `run-ts.mjs` | 用 Vite 的 SSR 加载器运行 TypeScript 脚本（`node tools/run-ts.mjs <入口.ts> [参数…]`） |

## 为什么不用 tsx / ts-node

项目已经依赖 Vite，直接借用它的 TS 转换即可，不必再引入一个运行时依赖。
被运行的脚本需要导出 `main(argv)`，例如 `test/simulate.ts`（`npm run simulate`）。
