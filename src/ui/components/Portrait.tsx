/**
 * 立绘渲染：用 SVG 的 viewBox 当作裁切框，取景完全由 portraits.ts 的参数决定。
 * 没有素材时渲染 null，由调用方退回字母圆形。
 */

import type { CharacterTypeId } from '../../core/GameState';
import { portraitFor, sourceRect } from '../portraits';

export interface PortraitProps {
  readonly typeId: CharacterTypeId;
  /** 展示框的宽高比（宽 / 高）。取景会按这个比例反算源矩形。 */
  readonly boxAspect: number;
  readonly className?: string;
  /** 用哪个取景（地图头像用小图 / 卡片用大图）。 */
  readonly framing?: 'token' | 'card';
}

export function Portrait({ typeId, boxAspect, className, framing = 'card' }: PortraitProps) {
  const asset = portraitFor(typeId);
  if (asset === null) return null;

  const useToken = framing === 'token';
  const size = useToken ? asset.tokenSize : asset.size;
  const url = useToken ? asset.tokenUrl : asset.url;
  const rect = sourceRectOf(asset, framing, boxAspect);
  const viewBox = rect.x + ' ' + rect.y + ' ' + rect.width + ' ' + rect.height;

  return (
    <svg
      className={className}
      viewBox={viewBox}
      preserveAspectRatio="none"
      role="presentation"
      aria-hidden="true"
    >
      <image
        href={url}
        x={0}
        y={0}
        width={size.width}
        height={size.height}
        preserveAspectRatio="none"
      />
    </svg>
  );
}

function sourceRectOf(
  asset: NonNullable<ReturnType<typeof portraitFor>>,
  framing: 'token' | 'card',
  boxAspect: number,
) {
  const size = framing === 'token' ? asset.tokenSize : asset.size;
  return sourceRect(asset[framing], boxAspect, size);
}
