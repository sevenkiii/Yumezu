/**
 * 对手头像：一个圆头像 + 一圈"剩余血量环"，点一下展开详情。
 *
 * 用环代替血条 + 数字是为了在顶栏里省横向空间；具体数值悬停可见、点开有详情。
 * 环是 SVG 的 dasharray：从 12 点方向顺时针，颜色取阵营色的**深色版**
 * （浅色顶栏上粉彩色对比度不够，见 theme.ts 的 PLAYER_INKS）。
 */

import type { CharacterState } from '../../core/GameState';
import type { UiText } from '../i18n';
import { portraitFor } from '../portraits';
import { PLAYER_INKS } from '../theme';
import { Portrait } from './Portrait';

/** 环的画布尺寸与半径（viewBox 单位，实际大小由 CSS 决定）。 */
const RING_SIZE = 44;
const RING_RADIUS = 20;
const RING_CENTER = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export interface HpAvatarProps {
  readonly text: UiText;
  readonly character: CharacterState;
  /** 详情是否展开（展开时头像外再套一圈高亮）。 */
  readonly expanded: boolean;
  readonly onToggle: () => void;
}

export function HpAvatar({ text, character, expanded, onToggle }: HpAvatarProps) {
  const characterText = text.character[character.typeId];
  const hasPortrait = portraitFor(character.typeId) !== null;
  const ratio = character.maxHp === 0 ? 0 : Math.max(0, character.hp / character.maxHp);
  const hpText = characterText.name + ' ' + text.format.hp(character.hp, character.maxHp);
  const className = [
    'hp-avatar',
    character.alive ? '' : 'hp-avatar--dead',
    expanded ? 'hp-avatar--open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={hpText}
      title={hpText}
    >
      <span className="hp-avatar__art">
        {hasPortrait ? (
          <Portrait
            typeId={character.typeId}
            boxAspect={1}
            framing="token"
            className="hp-avatar__art-img"
          />
        ) : (
          <span className="hp-avatar__initial">{characterText.name.slice(0, 1)}</span>
        )}
      </span>
      <svg
        className="hp-avatar__ring"
        viewBox={'0 0 ' + RING_SIZE + ' ' + RING_SIZE}
        aria-hidden="true"
      >
        {/* 从 12 点方向开始顺时针画 */}
        <g transform={'rotate(-90 ' + RING_CENTER + ' ' + RING_CENTER + ')'}>
          <circle className="hp-avatar__track" cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} />
          {ratio > 0 ? (
            <circle
              className="hp-avatar__value"
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              stroke={PLAYER_INKS[character.owner]}
              strokeDasharray={RING_CIRCUMFERENCE * ratio + ' ' + RING_CIRCUMFERENCE}
            />
          ) : null}
        </g>
      </svg>
    </button>
  );
}
