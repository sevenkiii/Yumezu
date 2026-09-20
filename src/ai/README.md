# src/ai — 自动对局与 AI

用于批量模拟的决策器。**Phase 6 暂缓**，但 Phase 5 的模拟需要一个临时的"随机合法行动"决策器。

## 计划中的文件

| 文件 | 职责 |
|---|---|
| `RandomAgent.ts` | 从 `getLegalActions` 中随机选择，供 Phase 5 的自动对局使用 |
| `SearchAgent.ts` | 简单的合法动作搜索 AI（Phase 6，暂缓） |

## 关键约定

- AI 只能通过 `Action` 与引擎交互，不得直接读写 `GameState`。
- 必须确定性：随机决策也要走注入的 RNG。

> 状态：尚未实现（Phase 5 / Phase 6）。
