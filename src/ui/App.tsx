/**
 * 应用外壳：把 transport 的快照接到界面上，并把点击翻译成 Action。
 *
 * 操作模型：选中角色 → 地图高亮可达点与可攻击目标 → 点两次同一目标执行；
 * 技能由角色卡上的圆钮进入。角色卡与功能牌排成同一条底部扇形，
 * 选中卡牌时会在它的右边就地展开介绍。
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Action } from '../core/Action';
import type {
  CardId,
  CharacterId,
  EdgeKey,
  PlayerId,
  StatusType,
  VertexId,
} from '../core/GameState';
import type { GameEvent } from '../core/Event';
import { ActionLogPanel } from './components/ActionLogPanel';
import { CharacterCard } from './components/CharacterCard';
import { DetailPanel } from './components/DetailPanel';
import { HandView, fanLift, fanTilt } from './components/HandView';
import { ActionBar } from './components/ActionBar';
import { MapView } from './components/MapView';
import { NewGameScreen } from './components/NewGameScreen';
import { TeamPanel } from './components/TeamPanel';
import { getText } from './i18n';
import {
  INITIAL_UI_STATE,
  armSkill,
  clickCharacter,
  clickEdge,
  clickNode,
  clickStatus,
  computeHighlights,
  confirmAction,
  isArmedCharacter,
  isArmedEdge,
  isArmedNode,
  isArmedStatus,
  selectCard,
  selectDiscard,
  selectPass,
  type UiHighlights,
  type UiState,
} from './interaction';
import { createLocalTransport } from './transport';
import { useGameSnapshot } from './useGame';

export function App() {
  const text = useMemo(() => getText(), []);

  // 开发辅助：用 URL 参数直接进入对局（无头截图与手动调试用）
  const urlParams = useMemo(
    () =>
      typeof location === 'undefined'
        ? new URLSearchParams()
        : new URLSearchParams(location.search),
    [],
  );
  const [transport] = useState(() =>
    createLocalTransport({
      mapSeed: urlParams.get('mapSeed') ?? 'dream-1',
      gameSeed: urlParams.get('gameSeed') ?? 'game-1',
    }),
  );
  const snapshot = useGameSnapshot(transport);
  const [ui, setUi] = useState<UiState>(INITIAL_UI_STATE);
  const [started, setStarted] = useState(() => urlParams.get('autostart') === '1');
  const [panelOpen, setPanelOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [bannerKey, setBannerKey] = useState(0);
  /** 最近一次行动的事件，用于播"伤害飘字 / 移动轨迹"等表现，1 秒后清空。 */
  const [fxEvents, setFxEvents] = useState<readonly GameEvent[]>([]);
  /** ?select= 只生效一次，避免"清空选中后又被自动选回来"。 */
  const selectApplied = useRef(false);

  const legal = snapshot.legalActions;
  const highlights = useMemo(() => computeHighlights(legal, ui), [legal, ui]);
  const view = snapshot.view;
  const selectedCharacterId = ui.selectedCharacterId;
  const yourTurn = view.currentPlayer === view.viewer && !snapshot.finished;

  useEffect(() => {
    setUi(INITIAL_UI_STATE);
  }, [snapshot.stateHash]);

  useEffect(() => {
    if (snapshot.eventSeq === 0) return;
    setFxEvents(snapshot.lastEvents);
    const timer = setTimeout(() => setFxEvents([]), 1000);
    return () => clearTimeout(timer);
  }, [snapshot.eventSeq, snapshot.lastEvents]);

  useEffect(() => {
    if (!started) return;
    setBannerKey((key) => key + 1);
  }, [started, view.turnIndex, view.currentPlayer]);

  const update = (fn: (current: UiState, current_: UiHighlights) => UiState): void => {
    setUi((previous) => fn(previous, computeHighlights(legal, previous)));
  };

  const execute = (action: Action | null): void => {
    if (action !== null) transport.dispatch(action);
  };

  // ?select=0：自动选中第 N 名己方角色（截图 / 调试用）
  useEffect(() => {
    if (!started || selectApplied.current) return;
    const selectParam = urlParams.get('select');
    if (selectParam === null) return;
    if (ui.selectedCharacterId !== null) return;
    selectApplied.current = true;
    const own = view.characters.filter((character) => character.owner === view.viewer);
    const index = Number.parseInt(selectParam, 10);
    const target = own[Number.isNaN(index) ? 0 : index];
    if (target === undefined) return;
    setUi(() =>
      clickCharacter(INITIAL_UI_STATE, computeHighlights(legal, INITIAL_UI_STATE), target.id),
    );
  }, [started, urlParams, view, ui.selectedCharacterId, legal]);

  /* ---------- 点击：第一次瞄准，第二次执行 ---------- */

  const onCharacterClick = (id: CharacterId): void => {
    if (isArmedCharacter(ui, id) && highlights.pendingAction !== null) {
      execute(highlights.pendingAction);
      return;
    }
    update((current, h) => clickCharacter(current, h, id));
  };

  const onNodeClick = (vertex: VertexId): void => {
    if (isArmedNode(ui, vertex) && highlights.pendingAction !== null) {
      execute(highlights.pendingAction);
      return;
    }
    update((current, h) => clickNode(current, h, vertex));
  };

  const onEdgeClick = (edge: EdgeKey): void => {
    if (isArmedEdge(ui, edge) && highlights.pendingAction !== null) {
      execute(highlights.pendingAction);
      return;
    }
    update((current, h) => clickEdge(current, h, edge));
  };

  const onStatusClick = (status: StatusType): void => {
    if (isArmedStatus(ui, status) && highlights.pendingAction !== null) {
      execute(highlights.pendingAction);
      return;
    }
    update((current, h) => clickStatus(current, h, status));
  };

  const onSkillClick = (): void => {
    if (ui.pending.kind === 'SKILL' && highlights.pendingAction !== null) {
      execute(highlights.pendingAction);
      return;
    }
    update((current) => armSkill(current));
  };

  const onPassClick = (): void => {
    if (ui.pending.kind === 'PASS' && highlights.pendingAction !== null) {
      execute(highlights.pendingAction);
      return;
    }
    update((current) => selectPass(current));
  };

  const onDiscardClick = (handCardId: string): void => {
    if (
      ui.pending.kind === 'DISCARD' &&
      ui.pending.handCardId === handCardId &&
      highlights.pendingAction !== null
    ) {
      execute(highlights.pendingAction);
      return;
    }
    update((current) => selectDiscard(current, handCardId));
  };

  if (!started) {
    return (
      <div className="app app--start">
        <NewGameScreen
          text={text}
          onStart={(mapSeed, gameSeed) => {
            transport.startNewGame({ mapSeed, gameSeed });
            setUi(INITIAL_UI_STATE);
            setStarted(true);
          }}
        />
      </div>
    );
  }

  const own = view.characters.filter((character) => character.owner === view.viewer);
  const fanTotal = own.length + view.hand.length;
  /** 有选中的角色 / 正在瞄准的牌时才算"聚焦状态"（决定地图是否倾斜 + 自动取景）。 */
  const focused = selectedCharacterId !== null || ui.pending.kind !== 'IDLE';
  const focusKey = focused
    ? (selectedCharacterId ?? '') +
      '|' +
      ui.pending.kind +
      '|' +
      (ui.pending.kind === 'CARD' ? ui.pending.handCardId : '')
    : '';

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar__brand">
          <strong>{text.app.title}</strong>
          <span className="top-bar__subtitle">{text.app.subtitle}</span>
        </div>
        <div className="top-bar__status">
          <span className="chip">{text.phase[view.phase]}</span>
          <span className="chip">{text.format.turn(view.turnIndex)}</span>
          <span className={yourTurn ? 'chip chip--ready' : 'chip'}>
            {yourTurn ? text.player.currentTurn : text.player.waiting}
          </span>
        </div>
        <div className="top-bar__enemy">
          <TeamPanel
            view={view}
            text={text}
            highlights={highlights}
            selectedCharacterId={selectedCharacterId}
            title={text.panel.enemyTeam}
            side="ENEMY"
            variant="mini"
          />
        </div>
        <div className="top-bar__buttons">
          <button type="button" className="ghost" onClick={onPassClick} disabled={!yourTurn}>
            {text.action.pass}
          </button>
          <button
            type="button"
            className="ghost panel-toggle"
            onClick={() => setPanelOpen((open) => !open)}
          >
            {text.panel.actionLog}
          </button>
          <button type="button" className="ghost" onClick={() => setDevOpen((open) => !open)}>
            {text.dev.title}
          </button>
        </div>
      </header>

      <div className="app__main">
        <div className="app__board">
          <MapView
            view={view}
            highlights={highlights}
            ui={ui}
            text={text}
            focusKey={focusKey}
            fxEvents={fxEvents}
            onCharacter={onCharacterClick}
            onNode={onNodeClick}
            onEdge={onEdgeClick}
          />

          {!snapshot.finished ? (
            <div className="table__fan">
              {own.map((character, index) => {
                const selected = selectedCharacterId === character.id;
                return (
                  <div
                    key={character.id}
                    className="fan-slot"
                    style={
                      {
                        '--tilt': fanTilt(index, fanTotal, 9) + 'deg',
                        '--lift': fanLift(index, fanTotal, 14) + 'px',
                        zIndex: String(10 + index),
                      } as React.CSSProperties
                    }
                  >
                    <CharacterCard
                      text={text}
                      character={character}
                      variant="full"
                      selected={selected}
                      selectable={highlights.selectableCharacters.has(character.id)}
                      canUseSkill={highlights.canUseSkill && selected}
                      skillArmed={highlights.skillArmed && selected}
                      onSelect={() => onCharacterClick(character.id)}
                      onSkill={onSkillClick}
                    />
                    {selected ? (
                      <div
                        className={
                          // 偏右的牌把详情翻到左边展开，避免手机屏上探出屏幕
                          index >= fanTotal / 2 ? 'card-detail card-detail--flip' : 'card-detail'
                        }
                      >
                        <DetailPanel
                          view={view}
                          text={text}
                          characterId={character.id}
                          handCardId={null}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <HandView
                view={view}
                text={text}
                highlights={highlights}
                ui={ui}
                fanOffset={own.length}
                fanTotal={fanTotal}
                onSelect={(handCardId: string, cardId: CardId) =>
                  update((current) => selectCard(current, handCardId, cardId))
                }
                onDiscard={onDiscardClick}
              />
            </div>
          ) : null}

          {bannerKey > 0 && !snapshot.finished ? (
            <div key={bannerKey} className="turn-banner">
              {yourTurn ? text.player.currentTurn : text.player.waiting}
            </div>
          ) : null}

          {!snapshot.finished ? (
            <ActionBar
              text={text}
              ui={ui}
              highlights={highlights}
              onCancel={() => setUi(INITIAL_UI_STATE)}
              onDiscard={() => {
                if (ui.pending.kind !== 'CARD') return;
                const handCardId = ui.pending.handCardId;
                execute(confirmAction(computeHighlights(legal, selectDiscard(ui, handCardId))));
              }}
              onConfirm={() => execute(confirmAction(highlights))}
              onChooseStatus={onStatusClick}
            />
          ) : null}
        </div>

        <aside className={panelOpen ? 'app__side' : 'app__side app__side--closed'}>
          {devOpen ? (
            <section className="dev-panel">
              <h2 className="dev-panel__title">{text.dev.title}</h2>
              <div className="dev-panel__row">
                <button type="button" className="ghost" onClick={() => transport.setViewer(null)}>
                  {text.dev.followTurn}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => transport.setViewer('P1' as PlayerId)}
                >
                  {text.player.p1}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => transport.setViewer('P2' as PlayerId)}
                >
                  {text.player.p2}
                </button>
              </div>
              <div className="dev-panel__row">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    if (legal.length === 0) return;
                    execute(legal[Math.floor(Math.random() * legal.length)] as Action);
                  }}
                >
                  {text.dev.aiStep}
                </button>
              </div>
              <p className="dev-panel__hash">
                {text.dev.stateHash}: {snapshot.stateHash}
              </p>
            </section>
          ) : null}
          <ActionLogPanel view={view} text={text} />
        </aside>
      </div>

      {snapshot.finished ? (
        <footer className="app__bottom">
          <div className="result-banner">
            {view.result === null
              ? ''
              : view.result.kind === 'WIN'
                ? text.format.win(view.result.winner)
                : text.format.draw}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
