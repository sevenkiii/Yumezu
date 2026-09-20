# src/characters — 角色

角色类型、技能接口与 6 名角色的定义。

## 文件

| 文件 | 职责 |
|---|---|
| `Character.ts` | `CharacterDefinition` 与角色实例构造 |
| `Skill.ts` | 技能接口：`listChoices`（合法参数）+ `buildEffects`（生成效果） |
| `definitions/` | **每名角色一个文件**（见该目录 README） |

## 关键约定

- 面板数值与技能文本以 `RULES.md` §11 为准。
- 技能只产生 `Effect`，不直接改动状态。
- `listChoices` 为空 = 该技能此刻不可用（必须至少产生一个真实效果）。

> 状态：已实现（Phase 1，6 名角色）。
