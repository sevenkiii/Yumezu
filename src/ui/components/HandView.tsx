/**
 * 手牌：与角色卡共用同一条底部扇形（不单独占一行）。
 *
 * 组件只负责渲染"这一组牌"，扇形的位置与倾斜由 App 统一编排。
 */

import { cardDefinition } from '../../cards/Card';
import type { CardId } from '../../core/GameState';
import type { PlayerView } from '../../core/View';
import type { UiHighlights, UiState } from '../interaction';
import type { UiText } from '../i18n';

export interface HandViewProps {
  readonly view: PlayerView;
  readonly text: UiText;
  readonly highlights: UiHighlights;
  readonly ui: UiState;
  /** 这一组牌在整个扇形中的起始序号。 */
  readonly fanOffset: number;
  /** 整个扇形的牌数（用于算角度）。 */
  readonly fanTotal: number;
  readonly onSelect: (handCardId: string, cardId: CardId) => void;
  readonly onDiscard: (handCardId: string) => void;
}

/** 扇形角度：以中间为 0，向两侧张开。 */
export function fanTilt(index: number, count: number, spread: number): number {
  if (count <= 1) return 0;
  return ((index - (count - 1) / 2) / ((count - 1) / 2)) * spread;
}

/** 扇形纵向偏移：越靠外越往下。 */
export function fanLift(index: number, count: number, depth: number): number {
  if (count <= 1) return 0;
  const distance = Math.abs(index - (count - 1) / 2) / ((count - 1) / 2);
  return distance * depth;
}

export function HandView({
  view,
  text,
  highlights,
  ui,
  fanOffset,
  fanTotal,
  onSelect,
  onDiscard,
}: HandViewProps) {
  const selectedHandCardId = ui.pending.kind === 'CARD' ? ui.pending.handCardId : null;

  return (
    <>
      {view.hand.map((card, index) => {
        const cardText = text.card[card.cardId];
        const playable = highlights.playableCards.has(card.id);
        const fanIndex = fanOffset + index;

        return (
          <div
            key={card.id}
            className="fan-slot"
            style={
              {
                '--tilt': fanTilt(fanIndex, fanTotal, 11) + 'deg',
                '--lift': fanLift(fanIndex, fanTotal, 15) + 'px',
                zIndex: String(10 + fanIndex),
              } as React.CSSProperties
            }
          >
            <div
              className={
                'hand-card' +
                (playable ? '' : ' hand-card--disabled') +
                (selectedHandCardId === card.id ? ' hand-card--selected' : '')
              }
            >
              <button
                type="button"
                className="hand-card__main"
                onClick={() => onSelect(card.id, card.cardId)}
                disabled={!playable}
                title={cardText.description}
              >
                <span className="hand-card__seal">{cardText.name.slice(0, 1)}</span>
                <span className="hand-card__name">{cardText.name}</span>
                <span className="hand-card__category">
                  {text.cardCategory[cardDefinition(card.cardId).category]}
                </span>
                <span className="hand-card__description">{cardText.description}</span>
              </button>
              <button
                type="button"
                className="hand-card__discard"
                onClick={() => onDiscard(card.id)}
                title={text.action.discard}
              >
                {text.action.discard}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
