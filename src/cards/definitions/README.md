# src/cards/definitions — 功能牌定义

**每张牌一个文件。** 新增功能牌时在此目录添加文件，并在 `cards/README.md` 登记。

## 计划中的文件（V1 共 11 张）

| 文件 | 功能牌 |
|---|---|
| `FirstAid.ts` | 急救（单体回复 3 HP） |
| `Shield.ts` | 护盾（下一次受伤 −2） |
| `Assault.ts` | 强袭（下一次普通攻击 +1） |
| `Recharge.ts` | 充能（一个技能 CD −1） |
| `Purify.ts` | 净化（移除一个负面状态） |
| `Blink.ts` | 瞬步（友方移动至多 3 格） |
| `Repulse.ts` | 排斥（敌方移动到相邻节点） |
| `BlockRoad.ts` | 封路（封锁一条边） |
| `Mark.ts` | 标记（下一次受伤 +1） |
| `SealSkill.ts` | 封技（下一次不能使用专属技能） |
| `Trap.ts` | 陷阱（敌方进入受到 2 点伤害） |
| `index.ts` | 汇总并导出全部功能牌定义 |

> 状态：尚未实现（Phase 3）。各牌的精确效果见 `RULES.md` §12。
