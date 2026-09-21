/** 视觉常量：颜色与尺寸集中在这里，方便统一调整"水彩 + 战术棋盘"的基调。 */

import type { PlayerId, StatusType } from '../core/GameState';

/** 地图画布的逻辑尺寸：节点坐标是 0~1，乘以这个值后落进 SVG viewBox。 */
export const BOARD_SIZE = 1000;
export const BOARD_PADDING = 30;

/**
 * 地图元素的尺寸（SVG 用户单位，viewBox 为 1000 x 1000）。
 * 地图会自适应容器大小，因此这里的值要按"缩放到 600px 左右仍然清楚"来定。
 */
export const BOARD_SIZES = {
  edgeWidth: 4,
  edgeBlockedWidth: 6.5,
  edgeSelectableWidth: 8,
  edgeHitWidth: 34,
  nodeRadius: 20,
  nodeHitRadius: 40,
  tokenRadius: 19,
  tokenRingRadius: 27,
  tokenGlowRadius: 32,
  hpBarWidth: 54,
  hpBarHeight: 9,
  hpBarOffsetY: -52,
  hpTextOffsetY: -57,
  hpTextSize: 22,
  initialSize: 24,
  spinnerRadius: 6.5,
  spinnerGap: 14,
  spinnerOffsetY: 36,
  trapSize: 14,
  shadowRadius: 28,
  spawnRadius: 58,
} as const;

export const PLAYER_COLORS: Record<PlayerId, string> = {
  P1: '#ff9f7a',
  P2: '#7fd1ff',
};

export const STATUS_COLORS: Record<StatusType, string> = {
  Frozen: '#8fd3ff',
  SkillSealed: '#b58cff',
  Marked: '#ff7a7a',
  Shielded: '#ffd479',
  Empowered: '#ff9f7a',
};

export const STATUS_ORDER: readonly StatusType[] = [
  'Frozen',
  'SkillSealed',
  'Marked',
  'Shielded',
  'Empowered',
];

/** 地图坐标（0~1）→ SVG 坐标。 */
export function toBoardX(x: number): number {
  return BOARD_PADDING + x * (BOARD_SIZE - BOARD_PADDING * 2);
}

export function toBoardY(y: number): number {
  return BOARD_PADDING + y * (BOARD_SIZE - BOARD_PADDING * 2);
}
