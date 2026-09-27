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
  readonly onDiscard: () => void;
  readonly onChooseStatus: (status: StatusType) => void;
}

export function ActionBar({ text, ui, highlights, onDiscard, onChooseStatus }: ActionBarProps) {
  const statuses = [...highlights.statuses];
  const isCard = ui.pending.kind === 'CARD';
  // 交互减法后只剩两件"还需要再选一次"的事：弃牌、以及净化的状态选择
  const showActions = statuses.length > 0 || isCard;

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
        </div>
      ) : null}
    </>
  );
}
