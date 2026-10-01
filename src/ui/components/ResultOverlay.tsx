/**
 * 结算幕布：对局结束时盖住整屏，把胜负摆到玩家面前。
 *
 * 点任意处收起——收起后还能看最后的棋盘（页脚那条结果条会留着）。
 * 文案全部走 i18n；"胜利 / 败北"按当前视角判断，热座时谁赢就写谁。
 */

import type { PlayerView } from '../../core/View';
import { playerLabel } from '../formatEvent';
import type { UiText } from '../i18n';

export interface ResultOverlayProps {
  readonly view: PlayerView;
  readonly text: UiText;
  readonly onDismiss: () => void;
}

export function ResultOverlay({ view, text, onDismiss }: ResultOverlayProps) {
  const result = view.result;
  if (result === null) return null;

  const won = result.kind === 'WIN' && result.winner === view.viewer;
  const headline =
    result.kind === 'DRAW' ? text.format.draw : won ? text.result.victory : text.result.defeat;
  const detail = result.kind === 'WIN' ? text.format.win(playerLabel(result.winner, text)) : '';
  const tone = result.kind === 'DRAW' ? 'draw' : won ? 'win' : 'loss';

  return (
    <div className="result-overlay" onClick={onDismiss} role="presentation">
      <div className={'result-overlay__card result-overlay__card--' + tone}>
        <p className="result-overlay__headline">{headline}</p>
        {detail === '' ? null : <p className="result-overlay__detail">{detail}</p>}
        <p className="result-overlay__hint">{text.result.dismiss}</p>
      </div>
    </div>
  );
}
