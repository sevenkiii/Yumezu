# src/core — 核心引擎

游戏的心脏：状态、引擎、行动、效果与随机数。**不依赖任何 UI 或运行环境。**

## 计划中的文件

| 文件 | 职责 |
|---|---|
| `GameState.ts` | `GameState` 与子结构（`Player` / `Character` / `Status`）的类型定义 |
| `GameEngine.ts` | `applyAction` / `validateAction` / `getLegalActions`，即 `S_{t+1} = F(S_t, A_t)` |
| `Action.ts` | 行动类型：`MOVE` / `ATTACK` / `USE_SKILL` / `USE_CARD` / `DEPLOY` / `PASS` / `DISCARD` |
| `Effect.ts` | 统一效果系统（Damage / Heal / Move / AddStatus / …） |
| `Event.ts` | 事件与 Effect Queue 的连锁处理 |
| `RNG.ts` | `mulberry32` 与命名子流，保证同 seed 完全可复现 |
| `View.ts` | `getViewFor(state, playerId)`：按玩家裁剪的视图 |

## 关键约定

- 纯函数 + 不可变：不原地修改传入的状态。
- `validateAction` 返回结构化结果；`applyAction` 对非法输入抛异常。
- 禁止 `Math.random()` / `Date.now()` 与任何环境 API。
- `GameState` 必须可 JSON 序列化，且包含 RNG 状态。

> 状态：尚未实现（Phase 1）。
