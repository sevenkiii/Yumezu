/** 应用入口。 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui/App';
// 样式入口：内部声明 @layer 顺序并按层汇总（见 src/ui/styles/layers.css）
import './ui/styles/layers.css';

const container = document.getElementById('root');
if (container === null) throw new Error('找不到 #root 容器');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
