# src/core — 核心引擎

游戏的心脏：状态、引擎、行动、效果与随机数。**不依赖任何 UI 或运行环境。**

## 文件

| 文件            | 职责                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `GameState.ts`  | `GameState` 与子结构（角色、手牌、状态、陷阱、封锁边、`turnSlots`、结果）                     |
| `GameEngine.ts` | `createGame` / `validateAction` / `applyAction` / `getLegalActions`，即 S(t+1) = F(S(t), A(t)) |
| `Action.ts`     | 行动类型：`MOVE` / `ATTACK` / `USE_SKILL` / `USE_CARD` / `DEPLOY` / `PASS` / `DISCARD`         |
| `Effect.ts`     | 统一效果系统的类型定义（伤害来源、位移原因等）                                                 |
| `Event.ts`      | 事件类型：Action Log、调试与 UI 表现都读它                                                     |
| `RNG.ts`        | `mulberry32` + 命名子流，保证同 seed 完全可复现                                                |
| `View.ts`       | `getViewFor(state, viewer)`：按玩家裁剪视图（只返回自己的手牌，其他人的手牌仅数量）            |
| `Record.ts`     | 种子 + 行动序列的 JSON 回放格式、序列化与解析                                                  |
| `hash.ts`       | 键序稳定的序列化与 `hashState`，用于黄金测试与联机校验                                         |

## 关键约定

- 纯函数 + 不可变：`applyAction` 先深拷贝，返回全新对象，绝不修改入参。
- `validateAction` 返回结构化结果；`applyAction` 遇到非法输入抛 `EngineError`。
- 禁止 `Math.random()` / `Date.now()` 与任何环境 API（ESLint 强制）。
- `GameState` 必须可 JSON 序列化，并包含 RNG 状态。
- `state.seats` 是实际参赛座位及轮转顺序；遍历玩家时应使用它，而不是固定写 P1/P2。
- `state.turnSlots` 记录本回合两个操作槽位是否已用；`beginTurn` 重置，`PASS` 或两个槽位都用完才换人。
- `GameEvent[]` 是结算结果的唯一表现来源；UI 不根据 Action 猜测动画或战报。

入口：`createGameFromSeed()`；调试可用 `createGame()` 注入固定图或手动部署。
