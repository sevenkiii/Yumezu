/** 行动记录：最近若干回合的行动与事件（已过滤对手手牌内容）。 */

import type { PlayerView } from '../../core/View';
import { describeTurn } from '../formatEvent';
import type { UiText } from '../i18n';

export interface ActionLogPanelProps {
  readonly view: PlayerView;
  readonly text: UiText;
}

export function ActionLogPanel({ view, text }: ActionLogPanelProps) {
  const turns = view.recentTurns.slice().reverse();

  return (
    <section className="log-panel">
      <h2 className="log-panel__title">{text.panel.actionLog}</h2>
      <ol className="log-panel__list">
        {turns.map((turn, index) => {
          const lines = describeTurn(view, turn, text);
          if (lines.length === 0) return null;
          return (
            <li key={index} className="log-panel__item">
              {lines.map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  className={lineIndex === 0 ? 'log-line' : 'log-line log-line--sub'}
                >
                  {line}
                </div>
              ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
