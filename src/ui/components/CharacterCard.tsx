/**
 * 角色卡：以 assets/ui/card.png 为牌面，叠加立绘、名字、HP 与技能圆钮。
 *
 * variant="full" 用在自己的扇形手牌里（可选中、可用技能、可倾斜）；
 * variant="mini" 用在对手的小条上（只读，省空间）。
 */

import { characterDefinition } from '../../characters/Character';
import type { CharacterState } from '../../core/GameState';
import type { UiText } from '../i18n';
import { portraitFor } from '../portraits';
import { PLAYER_COLORS, STATUS_COLORS, STATUS_ORDER } from '../theme';
import { Portrait } from './Portrait';

export interface CharacterCardProps {
  readonly text: UiText;
  readonly character: CharacterState;
  readonly variant: 'full' | 'mini';
  readonly selected: boolean;
  readonly selectable: boolean;
  /** 技能圆钮是否可点。 */
  readonly canUseSkill?: boolean;
  /** 是否正在瞄准技能。 */
  readonly skillArmed?: boolean;
  /** 扇形排列时的倾斜角度（度）。 */
  readonly tilt?: number;
  /** 扇形排列时的纵向偏移（px）。 */
  readonly lift?: number;
  readonly onSelect?: () => void;
  readonly onSkill?: () => void;
}

export function CharacterCard({
  text,
  character,
  variant,
  selected,
  selectable,
  canUseSkill = false,
  skillArmed = false,
  tilt = 0,
  lift = 0,
  onSelect,
  onSkill,
}: CharacterCardProps) {
  const characterText = text.character[character.typeId];
  const ownerColor = PLAYER_COLORS[character.owner];
  const ratio = character.maxHp === 0 ? 0 : character.hp / character.maxHp;
  const statuses = STATUS_ORDER.filter((status) => character.statuses[status]);
  const hasPortrait = portraitFor(character.typeId) !== null;
  const definition = characterDefinition(character.typeId);
  const maxCd = definition.skill.cd;
  const cdProgress = maxCd <= 0 ? 1 : (maxCd - character.skillCd) / maxCd;

  const className = [
    'char-card',
    variant === 'mini' ? 'char-card--mini' : 'char-card--full',
    character.alive ? '' : 'char-card--dead',
    selected ? 'char-card--selected' : '',
    selectable ? 'char-card--selectable' : '',
    skillArmed ? 'char-card--aiming' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hint =
    characterText.role + ' · ' + characterText.skillName + '：' + characterText.skillDescription;

  return (
    <div
      className={className}
      title={hint}
      style={
        {
          '--tilt': tilt + 'deg',
          '--lift': lift + 'px',
          '--owner': ownerColor,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        className="char-card__body"
        onClick={onSelect}
        disabled={onSelect === undefined || !selectable}
      >
        <span className="char-card__art">
          {hasPortrait ? (
            <Portrait
              typeId={character.typeId}
              boxAspect={1}
              framing="card"
              className="char-card__art-img"
            />
          ) : (
            <span className="char-card__initial">{characterText.name.slice(0, 1)}</span>
          )}
          <span className="char-card__hpbar">
            <i style={{ width: (ratio * 100).toFixed(1) + '%', background: ownerColor }} />
          </span>
        </span>
        <span className="char-card__meta">
          <span className="char-card__name">{characterText.name}</span>
          <span className="char-card__hp-text">
            {text.format.hp(character.hp, character.maxHp)}
          </span>
        </span>
        {statuses.length > 0 ? (
          <span className="char-card__statuses">
            {statuses.map((status) => (
              <span
                key={status}
                className="char-card__status"
                style={{ borderColor: STATUS_COLORS[status], color: STATUS_COLORS[status] }}
                title={text.status[status].name + '：' + text.status[status].description}
              >
                {text.status[status].short}
              </span>
            ))}
          </span>
        ) : null}
      </button>

      {variant === 'full' ? (
        <button
          type="button"
          className="char-card__skill"
          onClick={onSkill}
          disabled={onSkill === undefined || !canUseSkill}
          style={{
            background:
              'conic-gradient(' +
              (character.skillCd <= 0 ? '#e7c887' : '#7fd1ff') +
              ' ' +
              (cdProgress * 100).toFixed(0) +
              '%, rgba(0,0,0,0.35) 0)',
          }}
          title={characterText.skillName + '：' + characterText.skillDescription}
        >
          <span className="char-card__skill-inner">
            <span className="char-card__skill-name">{characterText.skillName}</span>
          </span>
        </button>
      ) : null}
    </div>
  );
}
