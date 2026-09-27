/**
 * 渲染冒烟测试：用 react-dom/server 把界面组件渲染成字符串。
 * 目的是确保"真实状态喂进组件"不会抛异常，且关键信息确实出现；不需要 jsdom。
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createGame, getLegalActions } from '../src/core/GameEngine';
import { findCharacter } from '../src/core/GameState';
import { getViewFor } from '../src/core/View';
import { PHASE1_MAP, PHASE1_SPAWN_CENTERS } from '../src/map/fixtures';
import { App } from '../src/ui/App';
import { ActionBar } from '../src/ui/components/ActionBar';
import { ActionLogPanel } from '../src/ui/components/ActionLogPanel';
import { CharacterCard } from '../src/ui/components/CharacterCard';
import { HandView } from '../src/ui/components/HandView';
import { MapView } from '../src/ui/components/MapView';
import { TeamPanel } from '../src/ui/components/TeamPanel';
import { getText } from '../src/ui/i18n';
import {
  INITIAL_UI_STATE,
  armSkill,
  clickCharacter,
  computeHighlights,
  selectCard,
} from '../src/ui/interaction';
import { createBattleState } from './support/fixtures';

const text = getText();
const noop = () => undefined;

function battle() {
  return createBattleState({
    p1: ['Nana', 'Lily', 'Melty'],
    p2: ['Mikage', 'Spica', 'Urara'],
    positions: {
      'P1:Nana': 0,
      'P1:Lily': 13,
      'P1:Melty': 14,
      'P2:Mikage': 1,
      'P2:Spica': 23,
      'P2:Urara': 28,
    },
    hands: { P1: ['FirstAid', 'Blink'], P2: ['Shield'] },
    currentPlayer: 'P1',
  });
}

function highlightsOf(state: ReturnType<typeof battle>, ui = INITIAL_UI_STATE) {
  return computeHighlights(getLegalActions(state), ui);
}

describe('界面渲染冒烟测试', () => {
  it('开局界面能渲染', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain(text.app.title);
    expect(html).toContain(text.newGame.start);
  });

  it('地图渲染节点、立绘与高亮', () => {
    const state = battle();
    const ui = clickCharacter(INITIAL_UI_STATE, highlightsOf(state), 'P1:Nana');
    const html = renderToStaticMarkup(
      <MapView
        view={getViewFor(state, 'P1')}
        highlights={highlightsOf(state, ui)}
        ui={ui}
        text={text}
        focusKey=""
        onCharacter={noop}
        onNode={noop}
        onEdge={noop}
      />,
    );
    expect(html).toContain('<image');
    expect(html).toContain('token__hp-text');
    expect(html).toContain('node--move');
  });

  it('角色卡显示立绘、名字、HP 与技能圆钮', () => {
    const state = battle();
    const character = findCharacter(state, 'P1:Nana');
    if (character === null) throw new Error('missing');
    const html = renderToStaticMarkup(
      <CharacterCard
        text={text}
        character={character}
        variant="full"
        selected={true}
        selectable={true}
        canUseSkill={true}
        onSelect={noop}
        onSkill={noop}
      />,
    );
    expect(html).toContain(text.character.Nana.name);
    expect(html).toContain(text.format.hp(10, 10));
    expect(html).toContain(text.character.Nana.skillName);
    expect(html).toContain('char-card__art-img');
    expect(html).toContain('char-card--selected');
  });

  it('对手小卡能渲染', () => {
    const state = battle();
    const html = renderToStaticMarkup(
      <TeamPanel
        view={getViewFor(state, 'P1')}
        text={text}
        highlights={highlightsOf(state)}
        selectedCharacterId={null}
        title={text.panel.enemyTeam}
        side="ENEMY"
        variant="mini"
      />,
    );
    expect(html).toContain('Mikage');
    expect(html).toContain('char-card--mini');
  });

  it('手牌与角色牌排在同一条扇形里', () => {
    const state = battle();
    const html = renderToStaticMarkup(
      <HandView
        view={getViewFor(state, 'P1')}
        text={text}
        highlights={highlightsOf(state)}
        ui={INITIAL_UI_STATE}
        fanOffset={3}
        fanTotal={5}
        onSelect={noop}
        onDiscard={noop}
      />,
    );
    expect(html).toContain(text.card.FirstAid.name);
    expect(html).toContain('fan-slot');
    expect(html).toContain('hand-card__seal');
  });

  it('未选择时只有提示胶囊，没有浮动按钮', () => {
    const state = battle();
    const html = renderToStaticMarkup(
      <ActionBar
        text={text}
        ui={INITIAL_UI_STATE}
        highlights={highlightsOf(state)}
        onDiscard={noop}
        onChooseStatus={noop}
      />,
    );
    expect(html).toContain(text.prompt.SELECT_CHARACTER);
    expect(html).not.toContain('map-actions');
  });

  it('选中角色后提示变化，仍未浮现按钮', () => {
    const state = battle();
    const ui = clickCharacter(INITIAL_UI_STATE, highlightsOf(state), 'P1:Nana');
    const html = renderToStaticMarkup(
      <ActionBar
        text={text}
        ui={ui}
        highlights={highlightsOf(state, ui)}
        onDiscard={noop}
        onChooseStatus={noop}
      />,
    );
    expect(html).toContain(text.prompt.SELECT_TARGET_OR_DESTINATION);
    expect(html).not.toContain('map-actions');
  });

  it('单击执行后不再有确认按钮（浮动层只剩弃牌与状态选择）', () => {
    const state = battle();
    const armed = armSkill(clickCharacter(INITIAL_UI_STATE, highlightsOf(state), 'P1:Nana'));
    const aimed = clickCharacter(armed, highlightsOf(state, armed), 'P2:Mikage');
    const html = renderToStaticMarkup(
      <ActionBar
        text={text}
        ui={aimed}
        highlights={highlightsOf(state, aimed)}
        onDiscard={noop}
        onChooseStatus={noop}
      />,
    );
    expect(html).not.toContain('map-actions');
    expect(html).not.toContain(text.action.confirm);
  });

  it('选中手牌后浮现弃牌', () => {
    const state = battle();
    const ui = selectCard(INITIAL_UI_STATE, state.players.P1.hand[0]!.id, 'FirstAid');
    const html = renderToStaticMarkup(
      <ActionBar
        text={text}
        ui={ui}
        highlights={highlightsOf(state, ui)}
        onDiscard={noop}
        onChooseStatus={noop}
      />,
    );
    expect(html).toContain(text.action.discard);
  });

  it('默认开局由核心随机部署，直接进入战斗', () => {
    const state = createGame({
      mapSeed: 'render-deploy',
      gameSeed: 'render-deploy',
      graph: PHASE1_MAP,
      spawnCenters: { P1: PHASE1_SPAWN_CENTERS.P1, P2: PHASE1_SPAWN_CENTERS.P2 },
    });
    expect(state.phase).toBe('BATTLE');
    const view = getViewFor(state, 'P1');
    const html = renderToStaticMarkup(
      <MapView
        view={view}
        highlights={computeHighlights(getLegalActions(state), INITIAL_UI_STATE)}
        ui={INITIAL_UI_STATE}
        text={text}
        focusKey=""
        onCharacter={noop}
        onNode={noop}
        onEdge={noop}
      />,
    );
    expect(html).toContain('token__hp-text');
    expect(html).not.toContain('spawn-zone');
  });

  it('行动记录面板能渲染', () => {
    const html = renderToStaticMarkup(
      <ActionLogPanel view={getViewFor(battle(), 'P1')} text={text} />,
    );
    expect(html).toContain(text.panel.actionLog);
  });
});
