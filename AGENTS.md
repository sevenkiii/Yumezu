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
npm run dev            # 启动网页界面
npm run demo           # 跑完一整局 3v3
npm run build          # 类型检查 + 生产构建
npm run simulate -- --games 200 --seed base   # Phase 5 统计工具
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
- 工具脚本放在 `tools/`，用 `node tools/run-ts.mjs <入口.ts>` 运行（借 Vite 转 TS，不要再引入 tsx / ts-node）。
- **UI 只能通过 `src/ui/transport.ts` 读写对局**：组件不 import GameEngine，不读 GameState，
  所有可点目标都从 `legalActions` 推导（见 `src/ui/interaction.ts`），确认时提交"查到的那个 Action"。
- **UI 文案一律走 `src/ui/i18n`**，组件里不要出现玩家可见的字面量；引擎侧只保留 id。
- 角色立绘放 `assets/characters/`，地图用的缩略图由 `node tools/make-thumbnails.mjs` 生成；
  取景参数在 `src/ui/portraits.ts`（focusX / focusY / heightRatio），缺失素材要能回退成字母圆形。
- 样式在 `src/ui/styles/`：优先级由 `@layer` 声明（顺序见 `layers.css`），**规则必须写在层里**、
  **同一个选择器全文件只出现一次**；牌面元素不要用 `background` 简写（会盖掉 `card.png`）。

## 当前状态

**Phase 1 ~ 3 已完成**：核心引擎（不可变状态、注入 RNG、可 JSON 序列化）、随机平面图生成与出生点选择、
6 名角色 / 11 张功能牌。`npm run demo` 走"mapSeed → 生成地图 → 完整对局"的正式入口。

**Phase 4（网页界面）已完成到 4.8**：

- 4.1 ~ 4.3：可以完整对局；角色与功能牌都是卡牌样式，地图上使用角色立绘；
- 4.5：卡牌浮在桌面上（牌面素材 `assets/ui/card.png`），并取消人工选位（开局由核心随机部署，见 `RULES.md` §3）；
- 4.6 ~ 4.8：地图可缩放/拖拽、选中时自动聚焦并倾斜、伤害飘字，以及**交互减法**
  （单击即执行、悔棋、Esc / 点空白取消，见 `src/ui/README.md`）；
- 4.4 已完成的部分：角色**沿边逐跳移动**、攻击时的**撞击**（只有单体伤害才撞，AOE 略过）、回合交接幕布。

**Phase 5 已完成**：`npm run simulate` 的批量统计工具（决策器目前是随机的，见 `test/support/`）。

样式集中在 `src/ui/styles/`，按 `@layer` 分层（顺序在 `layers.css`）。当前 **14 个测试文件 / 125 个测试通过**。

下一步：Phase 6（更强的 AI，用来跑有意义的平衡统计），或 4.4 剩下的结果预览 / 音效。
`src/ai` 与 `src/server` 仍是空目录（只有 README）。
