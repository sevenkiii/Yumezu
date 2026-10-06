# src/server — 联机

**服务器权威**的联机对局：客户端只能提交 `Action`，收到的都是按座位裁剪好的视图。

## 文件

| 文件 | 职责 |
|---|---|
| `protocol.ts` | 客户端 ↔ 服务端的消息定义（`hello` / `action` / `ping` ↔ `welcome` / `waiting` / `snapshot` / `presence` / `error`） |
| `GameSession.ts` | **权威对局**：持有 GameState 与行动历史，校验并结算 Action，给两人各生成一份 `RoomSnapshot`。纯逻辑，不碰网络 |
| `Room.ts` | 房间与座位：房间号由玩家自定，同一房间最多两人；token 用于断线重连 |
| `server.ts` | HTTP + WebSocket 层：静态托管 `dist/`、编解码、广播、心跳 |
| `main.ts` | 入口与命令行参数（`--port` / `--host` / `--static` / `--no-static`） |

## 怎么跑

```bash
npm run server                      # 0.0.0.0:8787，顺带托管 dist/（先 npm run build）
npm run server -- --port 9000       # 换端口
npm run server -- --no-static       # 只提供联机服务
```

开发时前端仍然用 `npm run dev`：Vite 会把 `/ws` 代理到 8787（见 `vite.config.ts`），
所以**页面永远连自己这个源的 `/ws`** —— 本地、跨机、正式部署都是同一个地址，
邀请链接里不需要写服务器地址。

跨机游玩：把 `http://<你的地址>:<端口>/?room=房间号` 发给对手即可（两人房间号相同）。

## 关键约定

- **服务器权威**：客户端不能自行决定伤害、位置或技能结果；非法行动一律拒绝。
- **按玩家裁剪视图**：`getViewFor(state, viewer)` 已经隐藏对手手牌与抽牌/弃牌记录；
  另外**非行动方拿到的 `legalActions` 必须是空**——里面含手牌实例 id，发过去就等于泄露手牌。
- **确定性**：一局的全部真相 = 种子 + 行动序列（见 `core/Record.ts`），
  断线重连与复盘都靠它，不需要另存快照。
- **悔棋不可用**：那是本地对局的便利功能，不在规则内。

> 状态：核心已完成（房间、权威对局、重连、跨机可玩）。
> 观战、换设备接管、房间列表留给以后。
