# src/ai — AI

生产用 AI 尚未实现。当前批量模拟使用 `test/support/randomAgent.ts` 中的随机合法行动决策器。

后续 AI 放在本目录，建议拆分：

- 启发式对手：根据站位、威胁、HP 和手牌数量评分。
- Fuzzer：随机但确定性，用于覆盖复杂 Action 组合和抓引擎 bug。

## 约定

- AI 可以只读 `GameState` / `PlayerView`，但必须通过返回 `Action` 与引擎交互。
- 不直接修改状态，不复制 `validateAction` / `applyAction` 的规则。
- 随机决策必须使用注入 RNG，保证同一 seed 可复现。

随机决策器不是平衡数据来源；平衡应优先参考真人测试与对局记录。
