# Yumezu

基于はるまきごはん世界观的 1v1 回合制网页同人游戏。

> **随机平面图 + 3v3 角色战斗 + 功能牌 + 交替行动**

当前状态：**Phase 1 与 Phase 2 已完成**。

- Phase 1：无 UI 的纯核心引擎，可完整跑完一局 3v3（随机阵容、盲选部署、交替行动、移动 / 攻击 / 技能 / 功能牌、CD、陷阱与封路、胜负判定、Action Log）。
- Phase 2：由 `mapSeed` 生成随机平面图（Delaunay + 随机生成树 + 补边 + 修复 + 参数化 Validator）并选出公平的出生中心。

`npm run demo` 现在走的就是"地图 seed → 生成地图 → 一局完整对局"的正式入口。

- Phase 5（部分）：批量对局统计工具已可用（`npm run simulate`）；完整的平衡结论要等更聪明的 AI（Phase 6）。

## 文档

| 文件 | 作用 |
|---|---|
| [`RULES.md`](./RULES.md) | **V1 规则书 —— 实现与测试的唯一依据** |
| [`AGENTS.md`](./AGENTS.md) | 协作与工程约定（常用命令、架构约束） |
| `src/*/README.md` | 各模块的职责与文件说明 |

## 技术栈

TypeScript（strict）· Vite · React + SVG（Phase 4）· Vitest · ESLint + Prettier

运行时：Node v22.13.1 / npm

## 常用命令

```bash
npm install
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run demo    # 跑完一整局 3v3，输出阵容、胜者与行动统计
npm run simulate -- --games 200 --seed base   # Phase 5 统计：胜率 / 长度 / 角色与卡牌使用率
```

> `npm run dev` / `npm run build` 需要 UI 入口（`index.html`），会在 Phase 4 建立。
> 在 Phase 1 ~ Phase 3 期间，请用 `npm run test` 驱动核心引擎。

## 目录结构

```
src/
├── core/        GameState / GameEngine / Action / Effect / Event / RNG / View / hash
├── map/         Graph / triangulation / MapGenerator / MapValidator / SpawnGenerator / fixtures
├── characters/  Character / Skill + definitions/（每名角色一个文件）
├── cards/       Card / CardPool + definitions/（每张牌一个文件）
├── rules/       Targeting / Movement / Combat / EffectResolver / Turn / Action
├── ai/          自动对局与 AI（Phase 6，暂缓）
├── ui/          React + SVG 界面（Phase 4）
└── server/      WebSocket 联机（Phase 7）
tools/            开发脚本（用 Vite 运行 TS 的 run-ts.mjs）
test/            单元测试、黄金测试与随机对局 demo（support/ 放夹具与临时决策器）
```

## 开发阶段

| Phase | 内容 |
|---|---|
| 1 | ~~纯核心引擎~~ **已完成**：无 UI，能完整模拟一局 3v3 |
| 2 | ~~地图生成~~ **已完成**：随机平面图 + Validator + 出生点选择 |
| 3 | 6 名角色与 11 张功能牌（已在 Phase 1 一并实现，后续做内容调优） |
| 4 | 网页 UI（地图、角色、手牌、部署、合法行动高亮） |
| 5 | 测试与模拟（固定 seed、黄金测试已就绪；胜率统计工具已可用） |
| 6 | AI（暂缓） |
| 7 | 联机（WebSocket、服务器权威、断线重连） |
