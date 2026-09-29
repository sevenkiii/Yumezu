import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import { applyAction, createGame, getLegalActions, validateAction } from '../src/core/GameEngine';
import type { CardId, GameState } from '../src/core/GameState';
import { findCharacter } from '../src/core/GameState';
import {
  INITIAL_UI_STATE,
  armSkill,
  clickCharacter,
  clickEdge,
  clickNode,
  clickStatus,
  computeHighlights,
  isArmedCharacter,
  isArmedEdge,
  isArmedNode,
  isArmedStatus,
  actionAfterClick,
  placeDeployCharacter,
  selectCard,
  selectDeployCharacter,
  selectDiscard,
  selectPass,
  type UiState,
} from '../src/ui/interaction';
import { PHASE1_MAP, PHASE1_SPAWN_CENTERS } from '../src/map/fixtures';
import { createBattleState } from './support/fixtures';

function battle(
  hands: { P1?: CardId[]; P2?: CardId[] },
  positions?: Record<string, number>,
): GameState {
  return createBattleState({
    p1: ['Nana', 'Lily', 'Melty'],
    p2: ['Nana', 'Lily', 'Melty'],
    positions: positions ?? {
      'P1:Nana': 0,
      'P1:Lily': 13,
      'P1:Melty': 14,
      'P2:Nana': 1,
      'P2:Lily': 23,
      'P2:Melty': 28,
    },
    hands,
    currentPlayer: 'P1',
  });
}

function step(state: GameState, ui: UiState) {
  const legal = getLegalActions(state);
  return { legal, highlights: computeHighlights(legal, ui) };
}

function select(state: GameState, id: string): UiState {
  const ui = INITIAL_UI_STATE;
  return clickCharacter(ui, computeHighlights(getLegalActions(state), ui), id);
}

/** 瞄准后提交的动作必须是引擎认可的合法动作，而且真的能执行。 */
function expectPlayable(state: GameState, action: Action | null): Action {
  expect(action).not.toBeNull();
  const resolved = action as Action;
  expect(validateAction(state, resolved).ok).toBe(true);
  expect(() => applyAction(state, resolved)).not.toThrow();
  return resolved;
}

describe('UI 交互层：选中 → 高亮 → 点两次执行', () => {
  it('不给"移动 0 格"的落点：脚下节点不高亮、点了也不会执行', () => {
    const state = battle({});
    const legal = getLegalActions(state);
    const ui = select(state, 'P1:Nana');
    const positions = new Map(state.characters.map((item) => [item.id, item.position]));
    const selfNode = positions.get('P1:Nana') as number;

    // 引擎照旧允许"移动 0 格"（RULES.md §8.1：等价于放弃这次移动）
    expect(
      legal.some(
        (action) =>
          action.type === 'MOVE' && action.characterId === 'P1:Nana' && action.to === selfNode,
      ),
    ).toBe(true);

    // 不传位置表 = 引擎视角，落点里仍然有它
    expect(computeHighlights(legal, ui).moveNodes.has(selfNode)).toBe(true);

    // 界面视角：剔掉脚下这个点，其它落点保留
    const highlights = computeHighlights(legal, ui, positions);
    expect(highlights.moveNodes.has(selfNode)).toBe(false);
    expect(highlights.moveNodes.size).toBeGreaterThan(0);

    // 点脚下什么也不发生，不会白扔一个行动
    const after = clickNode(ui, highlights, selfNode);
    expect(after).toEqual(ui);
    expect(actionAfterClick(after, legal, positions)).toBeNull();
  });

  it('选中角色后直接给出可达点、可攻击对象与技能可用状态', () => {
    const state = battle({});
    const { highlights } = step(state, select(state, 'P1:Nana'));
    expect(highlights.moveNodes.size).toBeGreaterThan(0);
    expect(highlights.targetCharacters.has('P2:Nana')).toBe(true);
    expect(highlights.canUseSkill).toBe(true);
  });

  it('移动：点一次瞄准，再点同一节点即可执行', () => {
    const state = battle({});
    const ui = select(state, 'P1:Nana');
    const first = step(state, ui);
    const destination = [...first.highlights.moveNodes].find((vertex) => vertex !== 0) as number;

    const aimed = clickNode(ui, first.highlights, destination);
    const after = step(state, aimed);
    expect(isArmedNode(aimed, destination)).toBe(true);
    const action = expectPlayable(state, after.highlights.pendingAction);
    expect(action).toMatchObject({ type: 'MOVE', characterId: 'P1:Nana', to: destination });

    // 换另一个目标只是改选，不会执行
    const other = [...first.highlights.moveNodes].find(
      (vertex) => vertex !== 0 && vertex !== destination,
    ) as number;
    const switched = clickNode(aimed, step(state, aimed).highlights, other);
    expect(isArmedNode(switched, destination)).toBe(false);
    expect(isArmedNode(switched, other)).toBe(true);
  });

  it('普攻：点一次敌人瞄准，第二次点同一敌人执行', () => {
    const state = battle({});
    const ui = select(state, 'P1:Nana');
    const aimed = clickCharacter(ui, step(state, ui).highlights, 'P2:Nana');
    expect(isArmedCharacter(aimed, 'P2:Nana')).toBe(true);
    const action = expectPlayable(state, step(state, aimed).highlights.pendingAction);
    expect(action).toMatchObject({ type: 'ATTACK', targetId: 'P2:Nana' });
  });

  it('技能：圆钮进入瞄准 → 选目标', () => {
    const state = battle(
      {},
      {
        'P1:Nana': 0,
        'P1:Lily': 13,
        'P1:Melty': 14,
        'P2:Nana': 2,
        'P2:Lily': 23,
        'P2:Melty': 28,
      },
    );
    const ui = select(state, 'P1:Nana');
    const armed = armSkill(ui);
    expect(armed.pending.kind).toBe('SKILL');
    const before = step(state, armed);
    expect(before.highlights.skillArmed).toBe(true);
    expect(before.highlights.targetCharacters.has('P2:Nana')).toBe(true);
    expect(before.highlights.pendingAction).toBeNull();

    const aimed = clickCharacter(armed, before.highlights, 'P2:Nana');
    const action = expectPlayable(state, step(state, aimed).highlights.pendingAction);
    expect(action).toMatchObject({ type: 'USE_SKILL', characterId: 'P1:Nana' });
  });

  it('无目标技能：选中后即可确认（Melty Land）', () => {
    const state = battle(
      {},
      {
        'P1:Nana': 0,
        'P1:Lily': 13,
        'P1:Melty': 7,
        'P2:Nana': 8,
        'P2:Lily': 23,
        'P2:Melty': 28,
      },
    );
    const armed = armSkill(select(state, 'P1:Melty'));
    const view = step(state, armed);
    expect(view.highlights.canConfirm).toBe(true);
    expectPlayable(state, view.highlights.pendingAction);
  });

  it('位移技能：Spica 需要先选落点（星奔）', () => {
    const state = createBattleState({
      p1: ['Spica', 'Lily', 'Melty'],
      p2: ['Nana', 'Lily', 'Melty'],
      positions: {
        'P1:Spica': 0,
        'P1:Lily': 13,
        'P1:Melty': 14,
        'P2:Nana': 8,
        'P2:Lily': 23,
        'P2:Melty': 28,
      },
      currentPlayer: 'P1',
    });
    const armed = armSkill(select(state, 'P1:Spica'));
    const before = step(state, armed);
    expect(before.highlights.canConfirm).toBe(false);
    expect(before.highlights.moveNodes.size).toBeGreaterThan(0);

    const aimed = clickNode(armed, before.highlights, 1);
    expectPlayable(state, step(state, aimed).highlights.pendingAction);
  });

  it('手牌：急救 → 选己方角色', () => {
    const state = battle({ P1: ['FirstAid'] });
    const nana = findCharacter(state, 'P1:Nana');
    if (nana === null) throw new Error('missing');
    nana.hp = 6;

    const ui = selectCard(INITIAL_UI_STATE, state.players.P1.hand[0]!.id, 'FirstAid');
    const before = step(state, ui);
    const aimed = clickCharacter(ui, before.highlights, 'P1:Nana');
    expectPlayable(state, step(state, aimed).highlights.pendingAction);
  });

  it('手牌：瞬步 → 选角色再选落点', () => {
    const state = battle({ P1: ['Blink'] });
    const ui = selectCard(INITIAL_UI_STATE, state.players.P1.hand[0]!.id, 'Blink');
    const aimedCharacter = clickCharacter(ui, step(state, ui).highlights, 'P1:Nana');
    const before = step(state, aimedCharacter);
    expect(before.highlights.moveNodes.size).toBeGreaterThan(0);
    const aimed = clickNode(
      aimedCharacter,
      before.highlights,
      [...before.highlights.moveNodes][0] as number,
    );
    expectPlayable(state, step(state, aimed).highlights.pendingAction);
  });

  it('手牌：封路 → 选边', () => {
    const state = battle({ P1: ['BlockRoad'] });
    const ui = selectCard(INITIAL_UI_STATE, state.players.P1.hand[0]!.id, 'BlockRoad');
    const before = step(state, ui);
    expect(before.highlights.edges.size).toBeGreaterThan(0);
    const aimed = clickEdge(ui, before.highlights, '0-1');
    expect(isArmedEdge(aimed, '0-1')).toBe(true);
    expectPlayable(state, step(state, aimed).highlights.pendingAction);
  });

  it('手牌：陷阱 → 选节点', () => {
    const state = battle({ P1: ['Trap'] });
    const ui = selectCard(INITIAL_UI_STATE, state.players.P1.hand[0]!.id, 'Trap');
    const before = step(state, ui);
    expect(before.highlights.nodes.size).toBeGreaterThan(0);
    const aimed = clickNode(ui, before.highlights, 5);
    expectPlayable(state, step(state, aimed).highlights.pendingAction);
  });

  it('手牌：净化 → 选角色再选状态', () => {
    const state = battle({ P1: ['Purify'] });
    const nana = findCharacter(state, 'P1:Nana');
    if (nana === null) throw new Error('missing');
    nana.statuses.Frozen = true;
    nana.statuses.Marked = true;

    const ui = selectCard(INITIAL_UI_STATE, state.players.P1.hand[0]!.id, 'Purify');
    const aimedCharacter = clickCharacter(ui, step(state, ui).highlights, 'P1:Nana');
    const before = step(state, aimedCharacter);
    expect(before.highlights.statuses.size).toBe(2);

    const aimed = clickStatus(aimedCharacter, before.highlights, 'Frozen');
    expect(isArmedStatus(aimed, 'Frozen')).toBe(true);
    expectPlayable(state, step(state, aimed).highlights.pendingAction);
  });

  it('放弃行动与弃牌', () => {
    const state = battle({ P1: ['FirstAid'] });
    expectPlayable(state, step(state, selectPass(INITIAL_UI_STATE)).highlights.pendingAction);

    const cardId = state.players.P1.hand[0]!.id;
    const discardView = step(state, selectDiscard(INITIAL_UI_STATE, cardId));
    const action = expectPlayable(state, discardView.highlights.pendingAction);
    expect(action).toMatchObject({ type: 'DISCARD', handCardId: cardId });
  });

  it('部署：放置 3 名角色后确认', () => {
    const state = createGame({
      mapSeed: 'ui-deploy',
      gameSeed: 'ui-deploy',
      graph: PHASE1_MAP,
      spawnCenters: { P1: PHASE1_SPAWN_CENTERS.P1, P2: PHASE1_SPAWN_CENTERS.P2 },
      deployment: 'manual',
    });
    const own = state.characters.filter((character) => character.owner === 'P1').map((c) => c.id);

    let ui = selectDeployCharacter(INITIAL_UI_STATE, own[0] as string);
    let view = step(state, ui);
    expect(view.highlights.deployNodes.size).toBeGreaterThanOrEqual(3);
    expect(view.highlights.canConfirm).toBe(false);

    ui = placeDeployCharacter(ui, own[0] as string, 0);
    ui = placeDeployCharacter(ui, own[1] as string, 1);
    ui = placeDeployCharacter(ui, own[2] as string, 6);
    view = step(state, ui);
    expect(view.highlights.canConfirm).toBe(true);
    expectPlayable(state, view.highlights.pendingAction);
  });

  it('点击无高亮的位置不会改变选择', () => {
    const state = battle({});
    const ui = select(state, 'P1:Nana');
    const before = step(state, ui);
    const afterClick = clickNode(ui, before.highlights, 29);
    expect(afterClick).toEqual(ui);
    const afterCharacter = clickCharacter(ui, before.highlights, 'P2:Melty');
    expect(afterCharacter).toEqual(ui);
  });

  it('再点一次已选中的角色会取消选中（详情收起）', () => {
    const state = battle({});
    const ui = select(state, 'P1:Nana');
    expect(ui.selectedCharacterId).toBe('P1:Nana');
    const again = clickCharacter(ui, step(state, ui).highlights, 'P1:Nana');
    expect(again.selectedCharacterId).toBeNull();
    expect(again.pending.kind).toBe('IDLE');
  });

  it('选中一张手牌会清空角色选中（不会同时显示两张卡的信息）', () => {
    const state = battle({ P1: ['FirstAid'] });
    const ui = select(state, 'P1:Nana');
    const withCard = selectCard(ui, state.players.P1.hand[0]!.id, 'FirstAid');
    expect(withCard.selectedCharacterId).toBeNull();
    expect(withCard.pending.kind).toBe('CARD');

    // 再点同一张牌 = 取消选中
    const again = selectCard(withCard, state.players.P1.hand[0]!.id, 'FirstAid');
    expect(again).toEqual(INITIAL_UI_STATE);
  });

  it('没有合法行动时高亮为空', () => {
    const view = computeHighlights([], INITIAL_UI_STATE);
    expect(view.canConfirm).toBe(false);
    expect(view.canUseSkill).toBe(false);
    expect(view.selectableCharacters.size).toBe(0);
    expect(view.pendingAction).toBeNull();
  });

  it('单击执行：点一次可达节点就直接产出 MOVE', () => {
    const state = battle({});
    const ui = select(state, 'P1:Nana');
    const { highlights } = step(state, ui);
    const destination = [...highlights.moveNodes].find((vertex) => vertex !== 0) as number;

    const afterClick = clickNode(ui, highlights, destination);
    const action = actionAfterClick(afterClick, getLegalActions(state));

    expect(action).toMatchObject({ type: 'MOVE', characterId: 'P1:Nana', to: destination });
    expect(validateAction(state, action as Action).ok).toBe(true);
  });

  it('单击执行：点一次敌人就直接产出 ATTACK', () => {
    const state = battle({});
    const ui = select(state, 'P1:Nana');
    const { highlights } = step(state, ui);

    const afterClick = clickCharacter(ui, highlights, 'P2:Nana');
    const action = actionAfterClick(afterClick, getLegalActions(state));

    expect(action).toMatchObject({ type: 'ATTACK', characterId: 'P1:Nana', targetId: 'P2:Nana' });
  });

  it('单击执行：无目标的技能点一次圆钮就施放', () => {
    const state = battle(
      {},
      {
        'P1:Nana': 0,
        'P1:Lily': 13,
        'P1:Melty': 7,
        'P2:Nana': 8,
        'P2:Lily': 23,
        'P2:Melty': 28,
      },
    );
    const ui = select(state, 'P1:Melty');
    const afterClick = armSkill(ui);
    const action = actionAfterClick(afterClick, getLegalActions(state));
    expect(action).toMatchObject({ type: 'USE_SKILL', characterId: 'P1:Melty' });
  });

  it('单击执行：净化这类还需要选参数的牌不会被提前提交', () => {
    const state = battle({ P1: ['Purify'] });
    const nana = findCharacter(state, 'P1:Nana');
    if (nana === null) throw new Error('missing');
    nana.statuses.Frozen = true;
    nana.statuses.Marked = true;

    const ui = selectCard(INITIAL_UI_STATE, state.players.P1.hand[0]!.id, 'Purify');
    const afterTarget = clickCharacter(ui, step(state, ui).highlights, 'P1:Nana');
    expect(actionAfterClick(afterTarget, getLegalActions(state))).toBeNull();

    const afterStatus = clickStatus(afterTarget, step(state, afterTarget).highlights, 'Frozen');
    expect(actionAfterClick(afterStatus, getLegalActions(state))).toMatchObject({
      type: 'USE_CARD',
    });
  });
});
