# AGENTS.md — 夢図（Yumezu）

面向在本仓库工作的协作者（含 AI 助手）的注意事项。保持简短。

## 第一原则

- **`RULES.md` 是实现与测试的唯一依据。** 与它冲突时以它为准。
- 根目录的 `statement.md` / `characters.md` / `cards.md` / `dev.md` / `clarify.md` / `answer.md` 是本地设计稿与讨论记录，已被 `.gitignore` 忽略：**不要修改、不要提交，也不要把它们当作最新依据**。
- **不要擅自 `git commit` / `git push`**，只在用户明确要求时提交。

## 常用命令

```bash
npm install
npm run lint           # eslint .
npm run format         # prettier --write
npm run format:check   # prettier --check（CI 使用）
npm run typecheck      # tsc --noEmit
npm run test           # vitest run
npm run test:watch
```

CI 依次执行 lint → format:check → typecheck → test。改动后请本地跑通。

## 架构约束（重要）

- 分层：`src/core`（GameState / Engine / Action / Effect / Event / RNG）、`src/map`、`src/characters`、`src/cards`、`src/rules`、`src/ai`、`src/ui`、`src/server`；测试与模拟放在 `test/`。
- `src/core`、`src/map`、`src/rules`、`src/characters`、`src/cards` **不得**引用 DOM、React、SVG、Node API 或网络 API（已有 ESLint 规则拦截）。
- 这些目录同样**禁止** `Math.random()` 与 `Date.now()`；所有随机必须走注入的 RNG（见 `RULES.md` §15）。
- 引擎层零第三方运行时依赖。唯一例外是 Delaunay 三角剖分，必须封装在 `src/map/triangulation.ts` 内。
- 状态不可变：`applyAction(state, action)` 返回新状态，不原地修改。
- `validateAction(state, action)` 返回结构化结果；`applyAction` 遇到非法输入抛异常；需要提供 `getLegalActions(state, playerId)`。
- `GameState` 必须可 JSON 序列化（回放、联机、测试哈希都依赖它）。

## 代码约定

- 每个目录一个 `README.md`（简要说明职责与文件用途）；新增文件时同步更新。
- 关键类型与函数写简短 TSDoc。
- TypeScript `strict` + `noUncheckedIndexedAccess`；不要使用 `any`，需要时先讨论。
- UI 文案默认中文，但必须通过 i18n 接口，不要在组件里硬编码字符串。
- 模块划分参照「每个角色一个文件、每张功能牌一个文件」的粒度。

## 当前状态

骨架已初始化，**尚未开始实现**。下一步是 Phase 1：无 UI 的纯核心引擎。
