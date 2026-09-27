# src/ui — 网页界面

React + SVG 界面。**只负责显示状态与产生 Action，从不修改游戏状态。**

## 操作模型（4.8：交互减法）

1. 点击角色卡或地图上的角色 → 选中，地图立刻高亮**可达节点**与**可攻击的敌人**；
2. **单击即执行**：点一下高亮节点就是移动，点一下高亮的敌人就是普攻；技能点角色卡上的圆钮（无目标的技能点一次即施放，有目标的进入瞄准）；
3. 手牌同一套规则：选牌 → 高亮合法目标 / 落点 / 边 → 点一下执行；
4. **取消**：再点一次已选中的卡（或按 Esc、点地图空白处）；
5. **悔棋**：顶栏的「悔棋」按钮可以回退上一步——这是本地对局的便利功能，不是游戏规则（联机不可用）；
6. 只有"还需要再选一个参数"的情况才出现浮动层（弃牌、净化选状态）。

## 数据流

```
GameTransport（transport.ts）
   ↓ getSnapshot(): { view: PlayerView, legalActions: Action[] }
App（App.tsx）＋ interaction.ts（高亮与"点两次"的判定）
   ↓ components/* 渲染
确认 / 第二次点击 → transport.dispatch(action)
```

## 文件

| 文件 | 职责 |
|---|---|
| `App.tsx` | 应用外壳：顶栏（对手）/ 地图 / 底部卡牌轨道与行动条 |
| `transport.ts` | **UI 与引擎的唯一通道**：快照（视图 + 合法行动）与 dispatch |
| `useGame.ts` | 把 transport 接进 React（`useSyncExternalStore`） |
| `interaction.ts` | 交互状态机：点击 → 瞄准 → 执行；所有可点目标都从合法行动推导 |
| `portraits.ts` | 立绘资源与**取景参数**（focusX / focusY / heightRatio，可逐个角色调） |
| `formatEvent.ts` | 把引擎事件/行动翻译成日志文字 |
| `theme.ts` | 颜色、地图坐标与元素尺寸 |
| `styles.css` | 全部样式（水彩夜色 + 卡牌 + 清晰战术元素） |
| `i18n/` | 全部面向玩家的文案 |
| `components/` | 展示组件（角色卡、立绘、地图、手牌、详情、行动条…） |

## 硬性约束

1. **UI 不直接读 GameState**：只能通过 `transport.getSnapshot()`。
2. **不复制规则**：可点目标全部来自 `legalActions`，因此不可能提交非法动作。
3. **不硬编码文案**：所有文字来自 `i18n`。
4. **UI 私有状态**（选中角色、待瞄准目标）不进 GameState。

## 桌面（4.5 起）

- 角色卡与手牌都是**牌面**（`assets/ui/card.png`），以扇形浮在地图之上：左右两张略微外倾、鼠标悬停抬起。
- 点击角色卡 = 选中；卡片右下角的圆钮 = 技能（外圈是 CD 环）。
- 右侧"详情"面板常驻在宽屏上，点击卡牌时内容滑入；窄屏时变成抽屉。
- **不再有部署界面**：开局由核心随机部署（见 `RULES.md` §3），界面直接进入战斗。

## 立绘与取景

- 原图放在 `assets/characters/*.png`，地图用的小图在 `assets/characters/token/`（由 `node tools/make-thumbnails.mjs` 生成）。
- 觉得某个角色的头像裁切不对，改 `portraits.ts` 里那一个数字即可（`focusY` 往上/往下）。
- 没有素材时会自动退回字母圆形，不会崩。

## 本地运行

```bash
npm run dev     # 开发服务器
npm run build   # 类型检查 + 生产构建
```

## 尚未实现（4.4）

- 行动动画、伤害飘字、沿边逐跳移动、影返轨迹
- 瞄准时的结果预览（"这一下能打死"）
- 回合交接幕布、音效、地图缩放

> 状态：Phase 4.1 ~ 4.3 已完成（完整对局 + 卡牌化视觉 + 立绘）。
