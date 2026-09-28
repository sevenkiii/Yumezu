/** 应用入口。 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui/App';
import './ui/styles.css';
// 浅色主题的最终覆盖层，必须排在 styles.css 之后
import './ui/theme-light.css';

const container = document.getElementById('root');
if (container === null) throw new Error('找不到 #root 容器');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
