# test — 测试与模拟

所有单元测试与自动对局模拟（Vitest，node 环境），以及 Phase 5 的统计工具。

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
| `simulation.test.ts` | 统计工具的可复现性与统计口径校验 |
| `simulate.ts` | **统计工具 CLI**（用 `npm run simulate` 运行，不是测试） |
| `support/simulate.ts` | 批量对局与统计聚合（胜率 / 长度 / 角色 / 卡牌） |
| `support/fixtures.ts` | 测试夹具：快速搭出可复现的中局状态 |
| `support/randomAgent.ts` | 随机合法行动决策器（demo 与统计工具共用） |

## 统计工具

```bash
npm run simulate -- --games 200 --seed base --maxTurns 300
npm run simulate -- --games 50 --json        # 输出 JSON（不含逐局明细）
npm run simulate -- --games 50 --json-full   # 输出 JSON（含逐局明细）
```

输出内容：双方胜率、平局率、先手胜率、结束方式、对局长度（均值 / 中位数 / 极值）、
各角色出场与胜率、技能使用次数、各功能牌的抽到 / 打出 / 弃掉与使用率。

**注意**：这些数字反映的是当前随机决策器的行为，不是人类对局的平衡结论。
随机决策器有 85% 的概率优先选择"指向敌方"的行动，因此进攻型卡牌（排斥 / 标记 / 封技）
的使用率会显著高于防御型卡牌（急救 / 充能）。要看平衡，需要先有更强的 AI（Phase 6）。

## 关键约定

- 每个测试都能独立运行，不依赖执行顺序。
- 涉及随机的测试必须固定 seed。
- 规则变更时先更新 `RULES.md`，再更新对应测试。

> 状态：11 个测试文件 / 74 个测试通过。
