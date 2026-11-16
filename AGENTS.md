# AGENTS.md — 夢図（Yumezu）

面向接手本仓库的协作者与 AI。先读本文件，再按需阅读根 `README.md` 和对应目录 README。

## 第一原则

- **`RULES.md` 是实现与测试的唯一依据。** 冲突时以它为准。
- 根目录的 `statement.md` / `characters.md` / `cards.md` / `dev.md` / `clarify.md` / `answer.md`
  是忽略提交的本地设计稿，**不要修改或当作最新规则**。
- **不要擅自 commit / push**，只在用户明确要求时执行。

## 快速开始

```bash
npm ci
npm run dev      # 网页 + 开发联机服务；Vite 会把 /ws 代理到 127.0.0.1:8787
npm run build    # 类型检查 + 生产构建
npm run server   # 生产/联机入口：0.0.0.0:8787，同时托管 dist/
```

质量检查顺序：`npm run lint` → `npm run format:check` → `npm run typecheck` → `npm run test`。
当前基线：**22 个测试文件 / 158 个测试通过**。

## 项目结构

```text
Action → validateAction → applyAction(GameState) → GameState + GameEvent[]
                              ↑
            纯规则层 rules / characters / cards / map

GameState → getViewFor(seat) → PlayerView
                         ↓
              UI transport → React/SVG 或 WebSocket 快照
```

- `src/core`：状态、引擎、Action/Effect/Event、RNG、按座位裁剪的 View、稳定哈希、回放记录。
- `src/map`：平面图生成、校验、出生区域与图算法。
- `src/characters`、`src/cards`：角色与功能牌定义；每个角色/牌一个文件。
- `src/rules`：移动、战斗、目标、效果结算、回合与合法行动枚举。
- `src/ui`：React + SVG；只消费 `GameTransport` 快照，不直接读 GameState。
- `src/server`：服务器权威的 2 ~ 4 人房间、断线重连、WebSocket 协议。
- `test/`：单元、黄金、多人、联机与 UI 冒烟测试；模拟工具在 `test/simulate.ts`。
- `tools/`：TS 脚本运行器、缩略图、数值表生成。
- `src/ai/`：尚无生产实现；现有随机决策器仅用于 `test/support/`。

## 不可破坏的约束

- `src/core`、`src/map`、`src/rules`、`src/characters`、`src/cards` 禁止 DOM、React、Node、
  网络 API，以及 `Math.random()` / `Date.now()`；随机必须走注入 RNG。
- 引擎层零第三方运行时依赖；唯一例外是 `src/map/triangulation.ts` 中的 Delaunay。
- `applyAction(state, action)` 必须返回新状态，不原地修改；非法 Action 抛异常。
- `validateAction` 返回结构化结果；所有 UI 可点目标必须从 `getLegalActions` 推导。
- `GameState` 必须可 JSON 序列化；回放和联机依赖“种子 + 行动序列”。
- 一个回合 = 角色操作 ×1 + 功能牌操作 ×1（顺序不限）；两个槽位都用完或 `PASS` 才换人，
  `turnIndex` 以**回合**为单位递增。槽位在 `GameState.turnSlots`，`getLegalActions` 只返回未用槽位的行动。
- 联机只能向当前行动座位发送 `legalActions`；进行中的快照不得下发完整复盘种子。

## UI 约定

- UI 只能通过 `src/ui/transport.ts` 读写对局；组件不得 import `GameEngine` 或直接读 GameState。
- 所有玩家可见文案走 `src/ui/i18n`，组件里不要硬编码。
- 样式在 `src/ui/styles/`：规则必须写在 `@layer` 中，同一选择器在一个文件只出现一次；
  牌面元素不要用 `background` 简写，避免覆盖 `card.png`。
- 交互遵循“单击执行 + 悔棋”；选中角色后从 legal actions 生成高亮。
- 动画是表现层，不得写回状态。新旧事件批次必须先取消旧 Web Animations，避免回放串动画。
- 立绘在 `assets/characters/`，缩略图由 `node tools/make-thumbnails.mjs` 生成；
  取景参数在 `src/ui/portraits.ts`，缺图必须回退为字母圆形。

## 修改流程

1. 规则变化先改 `RULES.md`，再改实现与测试。
2. 新目录/新文件同步对应 README；关键类型和函数写简短 TSDoc。
3. 数值变化后运行 `npm run stats`，不要手改 `STATS.md`。
4. 完成前跑完整质量检查；新增随机测试必须固定 seed。
5. 不引入 `tsx` / `ts-node`；工具脚本使用 `node tools/run-ts.mjs <入口.ts>`。

## 当前状态

- 核心、地图、6 名角色、11 张牌、网页 UI、回放、统计工具均已完成。
- 联机核心已完成：2 ~ 4 人房间、服务器权威、按座位隐私、断线重连、开发自动服务。
- 尚未实现：正式 AI、观战、换设备接管、房间列表。
