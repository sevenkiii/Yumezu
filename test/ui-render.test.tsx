/**
 * 渲染冒烟测试：用 react-dom/server 把界面组件渲染成字符串。
 * 目的是确保"真实状态喂进组件"不会抛异常，且关键信息确实出现；不需要 jsdom。
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import { cardDefinition } from '../src/cards/Card';
import { CARD_POOL } from '../src/cards/CardPool';
import { characterDefinition } from '../src/characters/Character';
import { createGame, createGameFromSeed, getLegalActions } from '../src/core/GameEngine';
import { CHARACTER_TYPE_IDS, STATUS_TYPES, findCharacter } from '../src/core/GameState';
import { getViewFor } from '../src/core/View';
import { PHASE1_MAP, PHASE1_SPAWN_CENTERS } from '../src/map/fixtures';
import { App, GameScreen } from '../src/ui/App';
import { ActionBar } from '../src/ui/components/ActionBar';
import { ActionLogPanel } from '../src/ui/components/ActionLogPanel';
import { CharacterCard } from '../src/ui/components/CharacterCard';
import { HandView } from '../src/ui/components/HandView';
import { MapView } from '../src/ui/components/MapView';
import { Manual } from '../src/ui/components/Manual';
import { ReplayPanel } from '../src/ui/components/ReplayPanel';
import { EnemyStrip } from '../src/ui/components/EnemyStrip';
import { HpAvatar } from '../src/ui/components/HpAvatar';
import { ResultOverlay } from '../src/ui/components/ResultOverlay';
import { playerLabel } from '../src/ui/formatEvent';
import { getText } from '../src/ui/i18n';
import {
  INITIAL_UI_STATE,
  armSkill,
  clickCharacter,
  computeHighlights,
  selectCard,
  type UiState,
} from '../src/ui/interaction';
import { createLocalTransport } from '../src/ui/transport';
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
    expect(html).toContain(text.online.create);
    expect(html).toContain(text.online.join);
    expect(html).toContain(text.newGame.playerCountOption(2));
    expect(html).toContain(text.newGame.playerCountOption(3));
    expect(html).toContain(text.newGame.playerCountOption(4));
  });

  it('对局界面能渲染（本地 transport 直接喂给 GameScreen）', () => {
    const transport = createLocalTransport({ mapSeed: 'render-map', gameSeed: 'render-game' });
    const html = renderToStaticMarkup(<GameScreen transport={transport} text={text} />);
    const currentPlayer = transport.getSnapshot().view.currentPlayer;
    expect(html).toContain('class="map');
    expect(html).toContain('char-card--full');
    expect(html).toContain('enemy-strip');
    expect(html).toContain('turn-indicator--self');
    expect(html).toContain(text.format.yourTurn(playerLabel(currentPlayer, text)));
  });

  it('记录面板：联机进行中不给复制入口，结束后给可复制的全文', () => {
    const callbacks = { onLoad: () => true, onStop: noop, onStep: () => true, onBack: noop };
    const panelOf = (record: string, readOnly: boolean) =>
      renderToStaticMarkup(
        <ReplayPanel
          text={text}
          record={record}
          replay={null}
          readOnly={readOnly}
          {...callbacks}
        />,
      );

    // 进行中：服务端没有记录，就不摆按钮和空框
    const pending = panelOf('', true);
    expect(pending).toContain(text.dev.replay.pendingHint);
    expect(pending).not.toContain('>' + text.dev.replay.copy + '<');
    expect(pending).not.toContain('replay-panel__row');
    expect(pending).not.toContain('replay-panel__text');

    // 结束后：按钮 + 只读全文（http 下剪贴板不可用时也能手动复制）
    const record = JSON.stringify({
      version: 1,
      mapSeed: 'm',
      gameSeed: 'copy-check',
      playerCount: 4,
      maxTurns: null,
      actions: [],
    });
    const done = panelOf(record, true);
    expect(done).toContain(text.dev.replay.readonlyHint);
    expect(done).toContain('>' + text.dev.replay.copy + '<');
    expect(done).toContain('replay-panel__text--readonly');
    expect(done).toContain('copy-check');
    expect(done).not.toContain('>' + text.dev.replay.load + '<');

    // 本地：粘贴框可编辑，复制 / 载入都在
    const local = panelOf('{}', false);
    expect(local).toContain(text.dev.replay.hint);
    expect(local).toContain('>' + text.dev.replay.copy + '<');
    expect(local).toContain('>' + text.dev.replay.load + '<');
    expect(local).toContain(text.dev.replay.placeholder);
    expect(local).not.toContain('replay-panel__text--readonly');
  });

  it('开局界面就有说明书入口，且默认收起', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('manual-fab');
    expect(html).toContain(text.manual.open);
    expect(html).not.toContain('manual-overlay');
  });

  it('说明书：三个页签分别渲染玩法、六名角色与 11 张功能牌', () => {
    const pageOf = (tab: 'rules' | 'characters' | 'cards') =>
      renderToStaticMarkup(<Manual text={text} initialTab={tab} onClose={noop} />);

    const rules = pageOf('rules');
    expect(rules).toContain(text.manual.title);
    expect(rules).toContain(text.manual.statusTitle);
    for (const tab of ['rules', 'characters', 'cards'] as const) {
      expect(rules).toContain(text.manual.tabs[tab]);
    }
    for (const section of text.manual.sections) {
      expect(rules).toContain(section.title);
      expect(rules).toContain(section.lines[0] as string);
    }
    for (const status of STATUS_TYPES) expect(rules).toContain(text.status[status].name);
    // 分页生效：玩法页不该把功能牌页的内容一起渲染出来
    expect(rules).not.toContain(text.manual.poolHint);

    const characters = pageOf('characters');
    for (const typeId of CHARACTER_TYPE_IDS) {
      expect(characters).toContain(text.character[typeId].name);
      expect(characters).toContain(text.character[typeId].skillDescription);
    }
    // 数值从定义读：调平衡后说明书会自动跟着变（用 Mikage 的移动范围作锚点）
    expect(characters).toContain(
      '<dt>' +
        text.stat.moveRange +
        '</dt><dd>' +
        characterDefinition('Mikage').moveRange +
        '</dd>',
    );
    expect(characters).toContain('<image');

    const cards = pageOf('cards');
    expect(cards).toContain(text.manual.poolHint);
    for (const cardId of CARD_POOL) {
      expect(cards).toContain(text.card[cardId].name);
      expect(cards).toContain(text.card[cardId].description);
    }
    expect(cards).toContain('manual-card__tag--' + cardDefinition('BlockRoad').category);
    expect(CARD_POOL).toHaveLength(11);
  });

  it('提示胶囊只有一句主提示：用掉角色槽位后它自己变成「选择功能牌」', () => {
    const transport = createLocalTransport({ mapSeed: 'render-map', gameSeed: 'render-game' });
    const move = transport.getSnapshot().legalActions.find((action) => action.type === 'MOVE');
    expect(move).toBeDefined();
    transport.dispatch(move as Action);

    const html = renderToStaticMarkup(<GameScreen transport={transport} text={text} />);
    expect(html).toContain('map-hint');
    expect(html).toContain(text.prompt.SELECT_CARD);
    // 不再挂第二段槽位文字
    expect(html).not.toContain('map-hint__slot');
    expect(html).not.toContain('slot-chip');
    // 回合还没结束，仍然轮到自己
    expect(html).toContain('turn-indicator--self');
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
    // 没按下技能时，圆钮不该带高亮
    expect(html).not.toContain('char-card__skill--armed');

    // 按下技能、等玩家选目标：圆钮自己亮起来
    const aiming = renderToStaticMarkup(
      <CharacterCard
        text={text}
        character={character}
        selected={true}
        selectable={true}
        canUseSkill={true}
        skillArmed={true}
        onSelect={noop}
        onSkill={noop}
      />,
    );
    expect(aiming).toContain('char-card__skill--armed');
    expect(aiming).toContain('char-card--aiming');
  });

  it('对手条：按玩家分组、头像带血量环、点开才有详情', () => {
    const state = battle();
    const html = renderToStaticMarkup(
      <EnemyStrip view={getViewFor(state, 'P1')} text={text} title={text.panel.enemyTeam} />,
    );
    expect(html).toContain('Mikage');
    expect(html).toContain('hp-avatar');
    expect(html).toContain('hp-avatar__value');
    // 默认不展开：详情面板要点头像才出现
    expect(html).not.toContain('enemy-strip__detail');

    // 四人局：另外三家各 3 个头像
    const four = createGameFromSeed({
      mapSeed: 'render-four-map',
      gameSeed: 'render-four-game',
      playerCount: 4,
    });
    const fourHtml = renderToStaticMarkup(
      <EnemyStrip view={getViewFor(four, 'P1')} text={text} title={text.panel.enemyTeam} />,
    );
    expect(fourHtml).toContain(text.player.p2);
    expect(fourHtml).toContain(text.player.p3);
    expect(fourHtml).toContain(text.player.p4);
    expect(fourHtml.match(/<button[^>]*class="hp-avatar(?: |")/g)).toHaveLength(9);

    // 血量环按比例画弧；阵亡时不画
    const character = findCharacter(state, 'P2:Mikage');
    if (character === null) throw new Error('missing');
    character.hp = character.maxHp / 2;
    const half = renderToStaticMarkup(
      <HpAvatar text={text} character={character} expanded={false} onToggle={noop} />,
    );
    // 半径 20 的周长 ≈ 125.66：半血 = 半圈
    expect(half).toMatch(/stroke-dasharray="62\.83\d* 125\.66\d*"/);
    character.hp = 0;
    character.alive = false;
    const dead = renderToStaticMarkup(
      <HpAvatar text={text} character={character} expanded={false} onToggle={noop} />,
    );
    expect(dead).toContain('hp-avatar--dead');
    expect(dead).not.toContain('hp-avatar__value');
  });

  it('结算幕布按视角显示胜利 / 败北', () => {
    const state = battle();
    state.phase = 'FINISHED';
    state.result = { kind: 'WIN', winner: 'P2', reason: 'ANNIHILATION' };

    const asWinner = renderToStaticMarkup(
      <ResultOverlay view={getViewFor(state, 'P2')} text={text} onDismiss={noop} />,
    );
    expect(asWinner).toContain(text.result.victory);
    expect(asWinner).toContain(text.result.dismiss);

    const asLoser = renderToStaticMarkup(
      <ResultOverlay view={getViewFor(state, 'P1')} text={text} onDismiss={noop} />,
    );
    expect(asLoser).toContain(text.result.defeat);
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

  it('操作提示条：只在"还得再选个参数"时才浮现按钮', () => {
    const state = battle();
    const barOf = (ui: UiState): string =>
      renderToStaticMarkup(
        <ActionBar
          text={text}
          ui={ui}
          highlights={highlightsOf(state, ui)}
          onDiscard={noop}
          onChooseStatus={noop}
        />,
      );

    // 未选择：两个槽位都可用，提示同时给出角色与功能牌两条路
    const idle = barOf(INITIAL_UI_STATE);
    expect(idle).toContain(text.prompt.IDLE);
    expect(idle).not.toContain('map-actions');

    // 选中角色：提示变化，仍无浮动按钮
    const selected = clickCharacter(INITIAL_UI_STATE, highlightsOf(state), 'P1:Nana');
    const afterSelect = barOf(selected);
    expect(afterSelect).toContain(text.prompt.SELECT_TARGET_OR_DESTINATION);
    expect(afterSelect).not.toContain('map-actions');

    // 单击执行后不再需要确认按钮
    const armed = armSkill(selected);
    const aimed = clickCharacter(armed, highlightsOf(state, armed), 'P2:Mikage');
    const afterAim = barOf(aimed);
    expect(afterAim).not.toContain('map-actions');
    expect(afterAim).not.toContain(text.action.confirm);

    // 选牌后才浮现「弃牌」
    const cardUi = selectCard(INITIAL_UI_STATE, state.players.P1.hand[0]!.id, 'FirstAid');
    expect(barOf(cardUi)).toContain(text.action.discard);
  });

  it('角色槽位用完后，提示改成「选择一张功能牌」而不是让玩家去选角色', () => {
    const state = battle();
    // 只剩功能牌操作时，getLegalActions 里没有 MOVE/ATTACK/USE_SKILL
    const cardOnly = computeHighlights(
      getLegalActions(state).filter(
        (action) => action.type === 'USE_CARD' || action.type === 'DISCARD',
      ),
      INITIAL_UI_STATE,
    );
    const html = renderToStaticMarkup(
      <ActionBar
        text={text}
        ui={INITIAL_UI_STATE}
        highlights={cardOnly}
        onDiscard={noop}
        onChooseStatus={noop}
      />,
    );
    expect(html).toContain(text.prompt.SELECT_CARD);
    expect(html).not.toContain(text.prompt.SELECT_CHARACTER);
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
