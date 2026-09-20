# test — 测试与模拟

所有单元测试与自动对局模拟（Vitest，node 环境）。

## 文件

| 文件 | 覆盖内容 |
|---|---|
| `map.test.ts` | 固定地图的规模 / 结构 / 出生点、图工具 |
| `movement.test.ts` | 移动可达性、占用、封路、冻结 |
| `combat.test.ts` | 伤害管线、护盾 / 标记 / 影返、陷阱、阵亡 |
| `characters.test.ts` | 6 名角色的技能行为 |
| `cards.test.ts` | 11 张功能牌的效果与非法条件 |
| `engine.test.ts` | 确定性、部署、回合结构、CD、胜负、视图、合法行动 |
| `golden.test.ts` | 固定 seed 的整局一致性（状态哈希） |
| `demo.test.ts` | Phase 1 验收 demo：完整跑完一局并输出结果 |
| `support/fixtures.ts` | 测试夹具：快速搭出可复现的中局状态 |
| `support/randomAgent.ts` | 随机合法行动决策器（Phase 1 的临时对局驱动） |

## 关键约定

- 每个测试都能独立运行，不依赖执行顺序。
- 涉及随机的测试必须固定 seed。
- 规则变更时先更新 `RULES.md`，再更新对应测试。

> 状态：Phase 1 覆盖完成（59 个测试）。
