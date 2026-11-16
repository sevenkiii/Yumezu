# Yumezu

基于はるまきごはん世界观的 2 ~ 4 人回合制网页混战游戏。

> **随机平面图 + 每人 3 名角色 + 功能牌 + 多人轮流行动**

当前已具备完整本地对局、2 ~ 4 人联机、回放与统计工具。规则以
[`RULES.md`](./RULES.md) 为准；协作约定见 [`AGENTS.md`](./AGENTS.md)。

## 当前能力

- 确定性核心引擎：不可变 `GameState`、注入式 RNG、种子 + 行动序列回放。
- 随机平面图：按人数生成 36 / 44 / 52 个节点，并划分互不重叠的出生区域。
- 完整战斗：6 名角色、11 张功能牌、移动 / 攻击 / 技能 / 状态 / 陷阱 / 封路 / 胜负。
- 每回合两个操作槽位：角色操作（移动 / 普攻 / 技能）与功能牌操作（用牌 / 弃牌）各一次、顺序不限；两个都用完或点「结束回合」才换人。
- 网页界面：卡牌化操作、地图缩放取景、移动与撞击动画、响应式布局、i18n，以及随时可查的说明书（玩法 / 角色 / 功能牌）。
- 联机：服务器权威、按座位裁剪信息、2 ~ 4 人房间、断线重连。
- 工具：批量模拟、数值总表、行动记录 / 回放。

尚未实现正式 AI、观战、换设备接管与房间列表。

## 文档

| 文件                       | 作用                                                     |
| -------------------------- | -------------------------------------------------------- |
| [`RULES.md`](./RULES.md)   | **V1 规则书 —— 实现与测试的唯一依据**                    |
| [`AGENTS.md`](./AGENTS.md) | 协作与工程约定（常用命令、架构约束）                     |
| [`STATS.md`](./STATS.md)   | **数值总表**（`npm run stats` 从定义生成，调平衡看这张） |
| `src/*/README.md`          | 各模块的职责与文件说明                                   |

## 技术栈

TypeScript（strict）· Vite · React + SVG · Vitest · ESLint + Prettier

运行时：Node v22.13.1 / npm

## 常用命令

```bash
npm ci
npm run dev       # 网页 + 开发联机服务（自动、仅本机后端 8787）
npm run build     # 类型检查 + 生产构建
npm run server    # 生产入口：0.0.0.0:8787，并托管 dist/
npm run demo      # 无 UI 跑完一整局
npm run simulate -- --games 200 --seed base   # 批量统计
npm run stats     # 从定义重建 STATS.md
npm run lint
npm run format:check
npm run typecheck
npm run test
```

开发时页面连接当前源的 `/ws`，Vite 代理到本机 8787。生产部署先
`npm run build`，再运行 `npm run server`，访问 `http://<服务器>:8787/`。
联机邀请链接带 `?room=房间号&players=2|3|4`。

## 目录结构

```
src/
├── core/        GameState / GameEngine / Action / Effect / Event / RNG / View / hash
├── map/         Graph / triangulation / MapGenerator / MapValidator / SpawnGenerator / fixtures
├── characters/  Character / Skill + definitions/（每名角色一个文件）
├── cards/       Card / CardPool + definitions/（每张牌一个文件）
├── rules/       Targeting / Movement / Combat / EffectResolver / Turn / Action
├── ai/          生产 AI（尚未实现）
├── ui/          React + SVG 界面（transport / interaction / i18n / components / styles）
└── server/      WebSocket 联机（房间 / 权威会话 / 协议）
assets/characters/  角色立绘（原图 + token/ 缩略图）
tools/            TS 运行器、缩略图、数值表生成
test/             单元 / 黄金 / 联机 / UI 测试与模拟
```

关键入口：

- 引擎：`src/core/GameEngine.ts`
- 规则：`src/rules/`
- 正式地图入口：`createGameFromSeed()`（`src/core/GameEngine.ts`）
- UI 通道：`src/ui/transport.ts`
- 服务端：`src/server/main.ts`
- 规则书：`RULES.md`

## 许可证

除以下明确注明的例外部分外，本项目按 **GNU General Public License 第 3 版（GPL-3.0）** 授权。完整许可证文本见 [LICENSE](LICENSE)。GPL-3.0 仅适用于本项目作者拥有著作权的代码与素材。

### 第三方素材除外

`assets/characters/` 及其子目录、`assets/ui/hrmk/` 及其子目录中的图片为 **はるまきごはん** 的作品。其著作权及其他权利归 はるまきごはん 或其各自权利人所有。本项目及其维护者不拥有对这些图片的著作权或其他权利。

上述图片不属于 GPL-3.0 的授权范围，也不因包含在本项目中而按 GPL-3.0 授权。使用者如需使用这些图片，应自行获得权利人的许可。

本项目是非官方同人游戏项目，与 はるまきごはん 无任何官方关联。  
若权利人认为本项目中的内容侵犯其权利，请联系 `keluying2009[at]gmail[.]com`，我们将及时处理。

再分发本项目时，请保留本第三方素材声明，并确保 GPL-3.0 完整许可证文本随项目一并提供。
