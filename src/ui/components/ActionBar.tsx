/**
 * 地图上的浮动操作：提示胶囊 + 按需浮现的按钮。
 *
 * 取代原来固定在页面底部的整条操作栏：
 *  - 提示语是地图顶部的一枚小胶囊，不占布局高度；
 *  - 「确认 / 取消 / 弃牌 / 净化选项」只在真的需要选择时才浮现（「放弃行动」在顶栏）。
 */

import type { StatusType } from '../../core/GameState';
import type { UiHighlights, UiState } from '../interaction';
import { promptFor } from '../interaction';
import type { UiText } from '../i18n';

export interface ActionBarProps {
  readonly text: UiText;
  readonly ui: UiState;
  readonly highlights: UiHighlights;
  readonly onCancel: () => void;
  readonly onDiscard: () => void;
  readonly onConfirm: () => void;
  readonly onChooseStatus: (status: StatusType) => void;
}

export function ActionBar({
  text,
  ui,
  highlights,
  onCancel,
  onDiscard,
  onConfirm,
  onChooseStatus,
}: ActionBarProps) {
  const statuses = [...highlights.statuses];
  const isCard = ui.pending.kind === 'CARD';
  const inProgress = ui.pending.kind !== 'IDLE';
  const showActions = statuses.length > 0 || isCard || highlights.canConfirm;

  return (
    <>
      <div className="map-hint">{text.prompt[promptFor(ui, highlights)]}</div>

      {showActions ? (
        <div className="map-actions">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              className="ghost"
              onClick={() => onChooseStatus(status)}
              title={text.status[status].description}
            >
              {text.status[status].name}
            </button>
          ))}
          {isCard ? (
            <button type="button" className="ghost" onClick={onDiscard}>
              {text.action.discard}
            </button>
          ) : null}
          {inProgress ? (
            <button type="button" className="ghost" onClick={onCancel}>
              {text.action.cancel}
            </button>
          ) : null}
          {highlights.canConfirm ? (
            <button type="button" className="primary" onClick={onConfirm}>
              {text.action.confirm}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
