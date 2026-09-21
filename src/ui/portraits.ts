/**
 * 角色立绘资源与取景参数。
 *
 * 原图是 800 x 955 的竖图（透明背景 + 水彩边框），文件名与角色 id 对应；
 * token/ 下是等比例缩到 192px 高的小图，只在圆形头像上用（省流量）。
 *
 * 取景用"源图矩形"描述：focusX / focusY 是要对准的中心点（0~1），
 * heightRatio 是显示出来的源高度占原图高度的比例 —— 调这三个数就能改裁切。
 *
 * 默认值来自对像素的分析：头部中心大致在 y = 0.33 ~ 0.44，
 * 圆裁取 ~0.29 高度即可得到头肩构图。觉得不对就直接改这里的数字。
 */

import lilyToken from '../../assets/characters/token/lily.png';
import meltyToken from '../../assets/characters/token/melty.png';
import mikageToken from '../../assets/characters/token/mikage.png';
import nanaToken from '../../assets/characters/token/nana.png';
import spicaToken from '../../assets/characters/token/spica.png';
import uraraToken from '../../assets/characters/token/urara.png';
import lilyUrl from '../../assets/characters/lily.png';
import meltyUrl from '../../assets/characters/melty.png';
import mikageUrl from '../../assets/characters/mikage.png';
import nanaUrl from '../../assets/characters/nana.png';
import spicaUrl from '../../assets/characters/spica.png';
import uraraUrl from '../../assets/characters/urara.png';
import type { CharacterTypeId } from '../core/GameState';

export interface ArtFraming {
  /** 对准点的横向位置（0 = 最左，1 = 最右）。 */
  readonly focusX: number;
  /** 对准点的纵向位置（0 = 最上，1 = 最下）。 */
  readonly focusY: number;
  /** 显示出来的源高度 / 原图高度。 */
  readonly heightRatio: number;
}

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

export interface PortraitAsset {
  /** 卡片用的大图。 */
  readonly url: string;
  readonly size: ImageSize;
  /** 地图圆形头像用的小图。 */
  readonly tokenUrl: string;
  readonly tokenSize: ImageSize;
  readonly aspect: number;
  readonly token: ArtFraming;
  readonly card: ArtFraming;
}

const SOURCE_SIZE: ImageSize = { width: 800, height: 955 };
// 地图圆形头像的取景：六张立绘构图一致，所以共用一个纵向焦点。
// 单个角色要微调时，把 portrait(...) 的第三个参数换成具体的 focusY 即可。
const TOKEN_FOCUS_Y = 0.33;
const TOKEN_HEIGHT_RATIO = 0.62;
const TOKEN_SIZE: ImageSize = { width: 161, height: 192 };

function portrait(url: string, tokenUrl: string, tokenX = 0.5): PortraitAsset {
  return {
    url,
    size: SOURCE_SIZE,
    tokenUrl,
    tokenSize: TOKEN_SIZE,
    aspect: SOURCE_SIZE.width / SOURCE_SIZE.height,
    // 立绘是带圆角边框的头肩像：头部中心约在 y = 0.35，裁一半高度正好是头肩
    token: { focusX: tokenX, focusY: TOKEN_FOCUS_Y, heightRatio: TOKEN_HEIGHT_RATIO },
    card: { focusX: 0.5, focusY: 0.38, heightRatio: 0.72 },
  };
}

// 六张立绘构图一致（同一套边框、同样的头肩位置），因此共用一组取景参数。
export const PORTRAITS: Record<CharacterTypeId, PortraitAsset> = {
  Nana: portrait(nanaUrl, nanaToken),
  Lily: portrait(lilyUrl, lilyToken),
  Melty: portrait(meltyUrl, meltyToken),
  Mikage: portrait(mikageUrl, mikageToken),
  Spica: portrait(spicaUrl, spicaToken),
  Urara: portrait(uraraUrl, uraraToken),
};

export function portraitFor(typeId: CharacterTypeId): PortraitAsset | null {
  return PORTRAITS[typeId] ?? null;
}

export interface SourceRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 按"要把哪个点对准框中心"算出源矩形（单位是像素）。
 * 框的宽高比由调用方给出：地图头像传 1，角色卡传卡面宽高比。
 */
export function sourceRect(framing: ArtFraming, boxAspect: number, size: ImageSize): SourceRect {
  const height = Math.min(size.height, Math.max(1, framing.heightRatio * size.height));
  const width = Math.min(size.width, Math.max(1, height * boxAspect));
  const centerX = framing.focusX * size.width;
  const centerY = framing.focusY * size.height;
  return {
    x: clamp(centerX - width / 2, 0, size.width - width),
    y: clamp(centerY - height / 2, 0, size.height - height),
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
