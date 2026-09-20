# src/cards/definitions — 功能牌定义

**每张牌一个文件。** 新增功能牌时在此目录添加文件，并在 `index.ts` 登记。

| 文件 | 功能牌 | 核心效果 |
|---|---|---|
| `FirstAid.ts` | 急救 | 己方单体回复 3 HP |
| `Shield.ts` | 护盾 | 下一次受到伤害 -2 |
| `Assault.ts` | 强袭 | 下一次普通攻击 +1 |
| `Recharge.ts` | 充能 | 一个冷却中的技能 CD -1 |
| `Purify.ts` | 净化 | 移除一个负面状态 |
| `Blink.ts` | 瞬步 | 己方角色移动至多 3 格 |
| `Repulse.ts` | 排斥 | 敌方角色移动到相邻节点 |
| `BlockRoad.ts` | 封路 | 封锁一条边（3 次行动） |
| `Mark.ts` | 标记 | 下一次受到伤害 +1 |
| `SealSkill.ts` | 封技 | 下一次不能使用专属技能 |
| `Trap.ts` | 陷阱 | 敌方进入时受到 2 点伤害 |
| `index.ts` | — | 汇总并导出全部功能牌定义 |

> 状态：已实现（Phase 1）。各牌精确效果见 `RULES.md` §12。
