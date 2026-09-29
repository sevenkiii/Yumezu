/**
 * 详情面板：显示当前选中角色 / 手牌的完整信息（技能全文、数值、状态）。
 *
 * 放侧栏而不是让卡片就地展开，是为了不让底部卡牌轨道的高度跳动。
 */

import { cardDefinition } from '../../cards/Card';
import { characterDefinition } from '../../characters/Character';
import type { CharacterId } from '../../core/GameState';
import type { PlayerView } from '../../core/View';
import type { UiText } from '../i18n';
import { PLAYER_INKS, STATUS_INKS, STATUS_ORDER } from '../theme';
import { Portrait } from './Portrait';

export interface DetailPanelProps {
  readonly view: PlayerView;
  readonly text: UiText;
  readonly characterId: CharacterId | null;
  readonly handCardId: string | null;
}

export function DetailPanel({ view, text, characterId, handCardId }: DetailPanelProps) {
  const handCard =
    handCardId === null ? undefined : view.hand.find((card) => card.id === handCardId);

  if (handCard !== undefined) {
    const cardText = text.card[handCard.cardId];
    const definition = cardDefinition(handCard.cardId);
    return (
      <section className="detail">
        <h2 className="detail__title">{text.panel.detail}</h2>
        <p className="detail__name">{cardText.name}</p>
        <p className="detail__role">{text.cardCategory[definition.category]}</p>
        <p className="detail__body">{cardText.description}</p>
        <p className="detail__hint">{text.panel.cardHint}</p>
      </section>
    );
  }

  const character =
    characterId === null ? undefined : view.characters.find((item) => item.id === characterId);

  if (character === undefined) {
    return (
      <section className="detail">
        <h2 className="detail__title">{text.panel.detail}</h2>
        <p className="detail__body">{text.panel.selectHint}</p>
      </section>
    );
  }

  const characterText = text.character[character.typeId];
  const definition = characterDefinition(character.typeId);
  const ratio = character.maxHp === 0 ? 0 : character.hp / character.maxHp;
  const statuses = STATUS_ORDER.filter((status) => character.statuses[status]);

  return (
    <section className="detail">
      <h2 className="detail__title">{text.panel.detail}</h2>
      <div className="detail__art">
        <Portrait
          typeId={character.typeId}
          boxAspect={0.9}
          framing="card"
          className="detail__art-img"
        />
      </div>
      <p className="detail__name" style={{ color: PLAYER_INKS[character.owner] }}>
        {characterText.name}
      </p>
      <p className="detail__role">{characterText.role}</p>

      <div className="detail__row">
        <span className="hp-bar">
          <span
            className="hp-bar__fill"
            style={{
              width: (ratio * 100).toFixed(1) + '%',
              background: PLAYER_INKS[character.owner],
            }}
          />
        </span>
        <span className="detail__hp">{text.format.hp(character.hp, character.maxHp)}</span>
      </div>

      {statuses.length > 0 ? (
        <div className="detail__statuses">
          {statuses.map((status) => (
            <span
              key={status}
              className="char-card__status"
              style={{ borderColor: STATUS_INKS[status], color: STATUS_INKS[status] }}
              title={text.status[status].description}
            >
              {text.status[status].name}
            </span>
          ))}
        </div>
      ) : null}

      <p className="detail__skill">
        <span className="detail__skill-name">{characterText.skillName}</span>
        <span className="detail__cd">{text.format.cooldown(character.skillCd)}</span>
      </p>
      <p className="detail__body">{characterText.skillDescription}</p>

      <dl className="detail__stats">
        <dt>{text.stat.attackDamage}</dt>
        <dd>{character.attackDamage}</dd>
        <dt>{text.stat.moveRange}</dt>
        <dd>{character.moveRange}</dd>
        <dt>{text.stat.attackRange}</dt>
        <dd>{character.attackRange}</dd>
        <dt>{text.stat.skillCd}</dt>
        <dd>{definition.skill.cd}</dd>
      </dl>
    </section>
  );
}
