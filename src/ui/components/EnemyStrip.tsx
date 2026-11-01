/**
 * 顶栏的对手条：一行圆头像（血量环），点某个头像就地展开它的详情。
 *
 * "展开了谁"是组件自己的 UI 状态：对手不能被指挥，和 `UiState.selectedCharacterId`
 * （选中要行动的角色）不是一回事，所以不进 UiState。换回合就收起来，免得看的是上一回合的情报。
 */

import { useEffect, useState } from 'react';

import type { CharacterId } from '../../core/GameState';
import type { PlayerView } from '../../core/View';
import { playerLabel } from '../formatEvent';
import type { UiText } from '../i18n';
import { DetailPanel } from './DetailPanel';
import { HpAvatar } from './HpAvatar';

export interface EnemyStripProps {
  readonly view: PlayerView;
  readonly text: UiText;
  /** 队伍条标题（"对手角色"）。 */
  readonly title: string;
}

export function EnemyStrip({ view, text, title }: EnemyStripProps) {
  const [openId, setOpenId] = useState<CharacterId | null>(null);
  const players = view.seats.filter((player) => player !== view.viewer);

  useEffect(() => {
    setOpenId(null);
  }, [view.turnIndex, view.currentPlayer, view.viewer]);

  return (
    <section className="enemy-strip">
      <h2 className="enemy-strip__title">{title}</h2>
      <div className="enemy-strip__list">
        {players.map((player) => {
          const characters = view.characters.filter((character) => character.owner === player);
          return (
            <div
              key={player}
              className={
                player === view.currentPlayer
                  ? 'enemy-strip__group enemy-strip__group--acting'
                  : 'enemy-strip__group'
              }
            >
              <span className="enemy-strip__owner">{playerLabel(player, text)}</span>
              {characters.map((character) => (
                <div key={character.id} className="enemy-strip__item">
                  <HpAvatar
                    text={text}
                    character={character}
                    expanded={openId === character.id}
                    onToggle={() =>
                      setOpenId((current) => (current === character.id ? null : character.id))
                    }
                  />
                  {openId === character.id ? (
                    <div className="enemy-strip__detail">
                      <DetailPanel
                        view={view}
                        text={text}
                        characterId={character.id}
                        handCardId={null}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
