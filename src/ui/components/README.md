# src/ui/components — 展示组件

只负责"把 props 画出来"，不做规则判断、不读 GameState。

| 文件 | 职责 |
|---|---|
| `CharacterCard.tsx` | 角色卡：立绘 + 名字 + HP 条 + 状态 + 技能圆钮（CD 环）；`variant="mini"` 用于对手小条 |
| `Portrait.tsx` | 立绘渲染：用 SVG viewBox 当裁切框，取景来自 `portraits.ts` |
| `MapView.tsx` | 一张 SVG：边 / 陷阱 / 出生区 / 节点 / 影标记 / 圆形头像角色 |
| `TeamPanel.tsx` | 队伍条：己方用完整卡（`team-rail`），对手用迷你卡（`team-strip`） |
| `HandView.tsx` | 手牌（默认全展开，含弃牌按钮） |
| `ActionBar.tsx` | 地图顶部的提示胶囊 + 仅剩的按需浮层（弃牌 / 净化选状态）；单击执行后已无确认按钮 |
| `DetailPanel.tsx` | 选中卡牌后就地展开的介绍（名字、HP、技能全文、数值） |
| `ActionLogPanel.tsx` | 行动记录（已过滤对手手牌内容） |
| `NewGameScreen.tsx` | 开局界面（两个种子） |

## 约定

- 组件只接收 `view` / `highlights` / `text` 与回调，不 import GameEngine。
- 点击一律通过回调上抛，由 `App.tsx` 交给 `interaction.ts` 处理。
- 节点与边的点击热区要比图形本身大（节点 40 单位、边 34 单位），否则移动端点不中。
- 立绘缺失要能回退（字母圆形），不要把素材当成必需项。
