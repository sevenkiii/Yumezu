# tools — 开发脚本

| 文件 | 职责 |
|---|---|
| `run-ts.mjs` | 用 Vite 的 SSR 加载器运行 TypeScript 脚本（`node tools/run-ts.mjs <入口.ts> [参数…]`） |
| `make-thumbnails.mjs` | 把 `assets/characters/*.png` 缩成 `assets/characters/token/*.png`（192px 高，地图头像用） |

## 为什么不用 tsx / ts-node

项目已经依赖 Vite，直接借用它的 TS 转换即可，不必再引入一个运行时依赖。
被运行的脚本需要导出 `main(argv)`，例如 `test/simulate.ts`（`npm run simulate`）。

## 缩略图

```bash
node tools/make-thumbnails.mjs        # 默认缩到 192px 高
node tools/make-thumbnails.mjs 256    # 自定义目标高度
```

脚本自带 PNG 解码 / 面积平均缩放 / 编码，不依赖任何第三方库。
换立绘后重新跑一次即可；卡片仍然使用原图。
