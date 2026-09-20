# Yumezu

基于はるまきごはん世界观的 1v1 回合制网页同人游戏。

> **随机平面图 + 3v3 角色战斗 + 功能牌 + 交替行动**

当前状态：**项目骨架已初始化，尚未开始实现**。

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
```

> `npm run dev` / `npm run build` 需要 UI 入口（`index.html`），会在 Phase 4 建立。
> 在 Phase 1 ~ Phase 3 期间，请用 `npm run test` 驱动核心引擎。

## 目录结构

```
src/
├── core/        GameState / GameEngine / Action / Effect / Event / RNG
├── map/         图结构、地图生成、Validator、出生点选择
├── characters/  角色定义（每名角色一个文件）
├── cards/       功能牌定义（每张牌一个文件）
├── rules/       移动 / 战斗 / 回合规则
├── ai/          自动对局与 AI（Phase 6，暂缓）
├── ui/          React + SVG 界面（Phase 4）
└── server/      WebSocket 联机（Phase 7）
test/            单元测试与对局模拟
```

## 开发阶段

| Phase | 内容 |
|---|---|
| 1 | 纯核心引擎（无 UI，能完整模拟一局 3v3） |
| 2 | 地图生成（平面图、Validator、出生点） |
| 3 | 6 名角色与 11 张功能牌 |
| 4 | 网页 UI（地图、角色、手牌、部署、合法行动高亮） |
| 5 | 测试与模拟（固定 seed、胜率统计、黄金测试） |
| 6 | AI（暂缓） |
| 7 | 联机（WebSocket、服务器权威、断线重连） |
