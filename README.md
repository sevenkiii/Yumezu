# Yumezu

基于はるまきごはん世界观的 1v1 回合制网页同人游戏。

> **随机平面图 + 3v3 角色战斗 + 功能牌 + 交替行动**

当前状态：**Phase 1 ~ 5 已完成**（Phase 4 做到 4.8）。

- Phase 1：无 UI 的纯核心引擎，可完整跑完一局 3v3（随机阵容、盲选部署、交替行动、移动 / 攻击 / 技能 / 功能牌、CD、陷阱与封路、胜负判定、Action Log）。
- Phase 2：由 `mapSeed` 生成随机平面图（Delaunay + 随机生成树 + 补边 + 修复 + 参数化 Validator）并选出公平的出生中心。

`npm run demo` 现在走的就是"地图 seed → 生成地图 → 一局完整对局"的正式入口。

- Phase 3：6 名角色、11 张功能牌。
- Phase 4（网页 UI，已做到 4.8）：完整对局；角色与功能牌都是卡牌样式、地图上使用角色立绘
  （`npm run dev`）。操作：点角色卡选中 → 地图高亮可达点与可攻击目标 → **单击即执行**
  （技能是选中后浮在卡牌上方的那颗圆钮；悔棋在顶栏；Esc / 点空白取消选中）。
  另有地图缩放拖拽、选中自动取景与倾斜、角色沿边逐跳移动、攻击撞击、伤害飘字与回合幕布。
- Phase 5：批量对局统计工具已可用（`npm run simulate`）；完整的平衡结论要等更聪明的 AI（Phase 6）。
- 工具：`npm run stats` 生成数值总表 `STATS.md`；开发面板里可以**复制对局记录**给别人精确重放这一局。
- Phase 7（联机）：`npm run server` 起服务器权威的联机服务——两人用同一个房间号（或点邀请链接）
  就能打，支持断线重连与跨机。

## 文档

| 文件                       | 作用                                  |
| -------------------------- | ------------------------------------- |
| [`RULES.md`](./RULES.md)   | **V1 规则书 —— 实现与测试的唯一依据** |
| [`AGENTS.md`](./AGENTS.md) | 协作与工程约定（常用命令、架构约束）  |
| [`STATS.md`](./STATS.md)   | **数值总表**（`npm run stats` 从定义生成，调平衡看这张） |
| `src/*/README.md`          | 各模块的职责与文件说明                |

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
npm run dev     # 启动网页界面（Phase 4.1：可以直接玩一局）
npm run demo    # 跑完一整局 3v3，输出阵容、胜者与行动统计
npm run simulate -- --games 200 --seed base   # Phase 5 统计：胜率 / 长度 / 角色与卡牌使用率
npm run stats   # 重新生成数值总表 STATS.md
npm run server  # 联机服务端（0.0.0.0:8787；先 npm run build 就会顺带托管前端）
```

> `npm run dev` 打开网页界面；`npm run test` 跑核心引擎与界面的测试。

## 目录结构

```
src/
├── core/        GameState / GameEngine / Action / Effect / Event / RNG / View / hash
├── map/         Graph / triangulation / MapGenerator / MapValidator / SpawnGenerator / fixtures
├── characters/  Character / Skill + definitions/（每名角色一个文件）
├── cards/       Card / CardPool + definitions/（每张牌一个文件）
├── rules/       Targeting / Movement / Combat / EffectResolver / Turn / Action
├── ai/          自动对局与 AI（Phase 6，暂缓）
├── ui/          React + SVG 界面（transport / interaction / i18n / components / styles）
└── server/      WebSocket 联机（Phase 7）
assets/characters/  角色立绘（原图 + token/ 缩略图）
tools/            开发脚本（run-ts.mjs、make-thumbnails.mjs）
test/            单元测试、黄金测试与随机对局 demo（support/ 放夹具与临时决策器）
```

## 开发阶段

| Phase | 内容                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | ~~纯核心引擎~~ **已完成**：无 UI，能完整模拟一局 3v3                                                             |
| 2     | ~~地图生成~~ **已完成**：随机平面图 + Validator + 出生点选择                                                     |
| 3     | 6 名角色与 11 张功能牌（已在 Phase 1 一并实现，后续做内容调优）                                                  |
| 4     | 网页 UI —— **4.1 ~ 4.8 已完成**（可对局、卡牌化视觉、立绘、缩放取景、逐跳移动与撞击等）；4.4 余下结果预览 / 音效 |
| 5     | 测试与模拟 —— **已完成**（固定 seed、黄金测试、`npm run simulate` 统计工具）                                     |
| 6     | AI（暂缓；做完才能跑出有意义的平衡数据）                                                                         |
| 7     | 联机 —— **核心已完成**（WebSocket、服务器权威、断线重连、跨机可玩）；观战 / 换设备接管留待以后                    |

## 许可证

除以下明确注明的例外部分外，本项目按 **GNU General Public License 第 3 版（GPL-3.0）** 授权。完整许可证文本见 [LICENSE](LICENSE)。GPL-3.0 仅适用于本项目作者拥有著作权的代码与素材。

### 第三方素材除外

`assets/characters/` 及其子目录、`assets/ui/hrmk/` 及其子目录中的图片为 **はるまきごはん** 的作品。其著作权及其他权利归 はるまきごはん 或其各自权利人所有。本项目及其维护者不拥有对这些图片的著作权或其他权利。

上述图片不属于 GPL-3.0 的授权范围，也不因包含在本项目中而按 GPL-3.0 授权。使用者如需使用这些图片，应自行获得权利人的许可。

本项目是非官方同人游戏项目，与 はるまきごはん 无任何官方关联。  
若权利人认为本项目中的内容侵犯其权利，请联系 `keluying2009[at]gmail[.]com`，我们将及时处理。

再分发本项目时，请保留本第三方素材声明，并确保 GPL-3.0 完整许可证文本随项目一并提供。
