# src/rules — 规则

把规则从引擎中拆出来，使每条规则独立可测。

## 文件

| 文件 | 职责 |
|---|---|
| `Targeting.ts` | 敌我关系、距离、节点占用、参数比较 |
| `MovementRules.ts` | 移动可达性（移动距离）、节点占用、封路影响 |
| `CombatRules.ts` | 伤害结算管线（加算 → 减算 → 钳位） |
| `EffectResolver.ts` | Effect Queue：伤害、治疗、位移、换位、状态、CD、封锁、陷阱、影返 |
| `TurnRules.ts` | 开局初始化、回合开始 / 结束、CD 递减、抽牌、胜负判定 |
| `ActionRules.ts` | 行动校验与合法行动枚举 |

## 关键约定

- 本目录与 `src/core` 一样保持纯粹、确定、零环境依赖。
- 规则改动应先更新 `RULES.md`，再改代码与测试。

> 状态：已实现（Phase 1）。
