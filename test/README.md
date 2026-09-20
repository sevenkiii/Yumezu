# test — 测试与模拟

所有单元测试与自动对局模拟都放在此目录（Vitest，默认 node 环境）。

## 计划中的文件

| 文件 | 职责 |
|---|---|
| `map.test.ts` | 地图确定性、Validator、出生点合法性 |
| `movement.test.ts` | 移动可达性、节点占用、封路影响 |
| `combat.test.ts` | 伤害管线、状态消耗、击杀与胜负 |
| `characters.test.ts` | 6 名角色的技能行为 |
| `cards.test.ts` | 11 张功能牌的效果与非法条件 |
| `golden.test.ts` | 固定 seed 的黄金测试（断言状态哈希） |
| `demo.test.ts` | Phase 1 验收：自动跑完整局，输出 Action Log 与胜者 |

## 关键约定

- 每个测试都要能独立运行，不依赖执行顺序。
- 涉及随机的测试必须固定 seed。
- 规则变更时，先更新 `RULES.md`，再更新对应测试。

> 状态：尚未实现（Phase 1 起逐步补齐）。
