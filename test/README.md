# test — 测试与模拟

所有单元测试与自动对局模拟（Vitest，node 环境）。

## 文件

| 文件 | 覆盖内容 |
|---|---|
| `map.test.ts` | 固定网格地图的规模 / 结构 / 出生点、图工具 |
| `map-generator.test.ts` | 生成确定性、40 个 seed 的质量扫描、失败处理、与固定地图的一致性 |
| `spawn.test.ts` | 出生候选约束、地图中心、随机选点、无候选时的处理 |
| `movement.test.ts` | 移动可达性、占用、封路、冻结 |
| `combat.test.ts` | 伤害管线、护盾 / 标记 / 影返、陷阱、阵亡 |
| `characters.test.ts` | 6 名角色的技能行为 |
| `cards.test.ts` | 11 张功能牌的效果与非法条件 |
| `engine.test.ts` | 部署、回合结构、CD、胜负、视图、合法行动枚举 |
| `golden.test.ts` | 固定 seed 的整局一致性（状态哈希） |
| `demo.test.ts` | 验收 demo：随机地图 + 完整跑完一局 |
| `support/fixtures.ts` | 测试夹具：快速搭出可复现的中局状态 |
| `support/randomAgent.ts` | 随机合法行动决策器（demo 用的临时对局驱动） |

## 关键约定

- 每个测试都能独立运行，不依赖执行顺序。
- 涉及随机的测试必须固定 seed。
- 规则变更时先更新 `RULES.md`，再更新对应测试。

> 状态：10 个测试文件 / 70 个测试通过（Phase 1 + Phase 2）。
