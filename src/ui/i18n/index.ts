/**
 * i18n 入口：按 locale 取文案。
 *
 * 目前只有 zh-CN；新增语言时在这里登记即可，组件不需要改动。
 */

import { zhCN } from './zh-CN';
import type { Locale, UiText } from './types';

export const DEFAULT_LOCALE: Locale = 'zh-CN';

const TEXTS: Record<Locale, UiText> = {
  'zh-CN': zhCN,
};

export function getText(locale: Locale = DEFAULT_LOCALE): UiText {
  return TEXTS[locale] ?? zhCN;
}

/** 把任意字符串解析为受支持的 locale，失败时回退到默认语言。 */
export function resolveLocale(input: string | null | undefined): Locale {
  if (input === 'zh-CN') return 'zh-CN';
  return DEFAULT_LOCALE;
}

export { zhCN };
export type { Locale, UiText, CharacterText, CardText, StatusText } from './types';
