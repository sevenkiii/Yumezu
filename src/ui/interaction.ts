/**
 * 交互层：把点击翻译成"要么什么都不做，要么一个引擎认可的 Action"。
 *
 * 设计（RULES.md：UI 只是"显示状态 + 产生 Action"）：
 *  - 所有可点目标都从 getLegalActions 推导，UI 不复制任何规则；
 *  - 选中角色后直接高亮"可达点"与"可攻击对象"，点一次 = 瞄准，再点同一个 = 执行；
 *  - 技能由角色卡上的圆钮进入（armSkill），进入后点击只走技能判定；
 *  - 这里不出现任何文案：提示语用 PromptCode，由 i18n 翻译。
 */

import type { Action, CardChoice, SkillChoice } from '../core/Action';
import type {
  CardId,
  CharacterId,
  DeploymentAssignment,
  EdgeKey,
  StatusType,
  VertexId,
} from '../core/GameState';

export type PendingAction =
  | { readonly kind: 'IDLE' }
  | { readonly kind: 'MOVE'; readonly characterId: CharacterId; readonly to: VertexId | null }
  | {
      readonly kind: 'ATTACK';
      readonly characterId: CharacterId;
      readonly targetId: CharacterId | null;
    }
  | {
      readonly kind: 'SKILL';
      readonly characterId: CharacterId;
      readonly targetId: CharacterId | null;
      readonly to: VertexId | null;
    }
  | {
      readonly kind: 'CARD';
      readonly handCardId: string;
      readonly cardId: CardId;
      readonly targetId: CharacterId | null;
      readonly to: VertexId | null;
      readonly edge: EdgeKey | null;
      readonly vertex: VertexId | null;
      readonly status: StatusType | null;
    }
  | { readonly kind: 'PASS' }
  | { readonly kind: 'DISCARD'; readonly handCardId: string }
  | { readonly kind: 'DEPLOY'; readonly assignments: readonly DeploymentAssignment[] };

export interface UiState {
  /** 被选中的己方角色（仅 UI 状态，不属于 GameState）。 */
  readonly selectedCharacterId: CharacterId | null;
  readonly pending: PendingAction;
}

export const INITIAL_UI_STATE: UiState = { selectedCharacterId: null, pending: { kind: 'IDLE' } };

export interface UiHighlights {
  /** 有可用行动的己方角色（可点击选中）。 */
  readonly selectableCharacters: ReadonlySet<CharacterId>;
  /** 可以打出的手牌实例 id。 */
  readonly playableCards: ReadonlySet<string>;
  /** 可移动 / 可落点的节点。 */
  readonly moveNodes: ReadonlySet<VertexId>;
  /** 可选的角色目标（普攻 / 技能 / 功能牌）。 */
  readonly targetCharacters: ReadonlySet<CharacterId>;
  /** 可选的地图节点（陷阱一类）。 */
  readonly nodes: ReadonlySet<VertexId>;
  /** 可封路的边。 */
  readonly edges: ReadonlySet<EdgeKey>;
  /** 可选的状态（净化）。 */
  readonly statuses: ReadonlySet<StatusType>;
  /** 部署阶段可用的节点。 */
  readonly deployNodes: ReadonlySet<VertexId>;
  readonly deployAssignments: readonly DeploymentAssignment[];
  /** 技能圆钮是否可用（选中角色且技能就绪、未被封技）。 */
  readonly canUseSkill: boolean;
  /** 是否处于技能瞄准状态。 */
  readonly skillArmed: boolean;
  readonly canConfirm: boolean;
  /** 确认 / 执行时会提交的 Action。 */
  readonly pendingAction: Action | null;
}

export type PromptCode =
  | 'IDLE'
  | 'SELECT_CHARACTER'
  | 'SELECT_TARGET_OR_DESTINATION'
  | 'SELECT_DESTINATION'
  | 'SELECT_TARGET'
  | 'SELECT_NODE'
  | 'SELECT_EDGE'
  | 'SELECT_STATUS'
  | 'READY_TO_EXECUTE'
  | 'READY_TO_CONFIRM'
  | 'DEPLOY_SELECT_CHARACTER'
  | 'DEPLOY_SELECT_NODE'
  | 'DEPLOY_READY';

function setOf<T>(values: Iterable<T>): Set<T> {
  return new Set<T>(values);
}

const NO_ACTIONS: readonly Action[] = [];

export function computeHighlights(
  legalActions: readonly Action[] = NO_ACTIONS,
  ui: UiState = INITIAL_UI_STATE,
): UiHighlights {
  const selectableCharacters = setOf(
    legalActions
      .filter(
        (action) =>
          action.type === 'MOVE' || action.type === 'ATTACK' || action.type === 'USE_SKILL',
      )
      .map((action) => (action as Extract<Action, { characterId: CharacterId }>).characterId),
  );
  const playableCards = setOf(
    legalActions.filter((action) => action.type === 'USE_CARD').map((action) => action.handCardId),
  );

  const moveNodes = new Set<VertexId>();
  const targetCharacters = new Set<CharacterId>();
  const nodes = new Set<VertexId>();
  const edges = new Set<EdgeKey>();
  const statuses = new Set<StatusType>();
  const deployNodes = new Set<VertexId>();
  let deployAssignments: readonly DeploymentAssignment[] = [];
  let pendingAction: Action | null = null;
  let canUseSkill = false;

  const pending = ui.pending;
  const selected = ui.selectedCharacterId;

  if (pending.kind === 'IDLE' && selected !== null) {
    // 默认形态：选中角色 → 直接给出"能去哪 / 能打谁"，技能圆钮待命
    for (const action of legalActions) {
      if (action.type === 'MOVE' && action.characterId === selected) moveNodes.add(action.to);
      if (action.type === 'ATTACK' && action.characterId === selected) {
        targetCharacters.add(action.targetId);
      }
      if (action.type === 'USE_SKILL' && action.characterId === selected) canUseSkill = true;
    }
  }

  switch (pending.kind) {
    case 'IDLE':
      break;

    case 'MOVE':
      for (const action of legalActions) {
        if (action.type !== 'MOVE' || action.characterId !== pending.characterId) continue;
        moveNodes.add(action.to);
        if (pending.to !== null && action.to === pending.to) pendingAction = action;
      }
      break;

    case 'ATTACK':
      for (const action of legalActions) {
        if (action.type !== 'ATTACK' || action.characterId !== pending.characterId) continue;
        targetCharacters.add(action.targetId);
        if (pending.targetId !== null && action.targetId === pending.targetId)
          pendingAction = action;
      }
      break;

    case 'SKILL': {
      canUseSkill = true;
      const choices = skillChoicesFor(legalActions, pending.characterId).filter((choice) =>
        matchesSkillPartial(choice, pending),
      );
      for (const choice of choices) {
        if (choice.kind === 'SINGLE_TARGET' && pending.targetId === null) {
          targetCharacters.add(choice.targetId);
        } else if (choice.kind === 'MOVE_THEN_STRIKE' && pending.to === null) {
          moveNodes.add(choice.to);
        }
      }
      if (choices.length === 1) {
        const only = choices[0] as SkillChoice;
        if (isSkillChoiceComplete(only, pending)) {
          pendingAction = findSkillAction(
            legalActions,
            pending.characterId,
            choices[0] as SkillChoice,
          );
        }
      }
      break;
    }

    case 'CARD': {
      const choices = cardChoicesFor(legalActions, pending.handCardId).filter((choice) =>
        matchesCardPartial(choice, pending),
      );
      for (const choice of choices) {
        collectCardChoice(choice, pending, targetCharacters, moveNodes, nodes, edges, statuses);
      }
      if (choices.length === 1) {
        const only = choices[0] as CardChoice;
        if (isCardChoiceComplete(only, pending)) {
          pendingAction = findCardAction(legalActions, pending.handCardId, only);
        }
      }
      break;
    }

    case 'PASS':
      pendingAction = legalActions.find((action) => action.type === 'PASS') ?? null;
      break;

    case 'DISCARD':
      pendingAction =
        legalActions.find(
          (action) => action.type === 'DISCARD' && action.handCardId === pending.handCardId,
        ) ?? null;
      break;

    case 'DEPLOY': {
      deployAssignments = pending.assignments;
      const used = new Set(pending.assignments.map((item) => item.vertex));
      for (const action of legalActions) {
        if (action.type !== 'DEPLOY') continue;
        for (const assignment of action.assignments) deployNodes.add(assignment.vertex);
      }
      for (const vertex of used) deployNodes.delete(vertex);
      pendingAction = findDeployAction(legalActions, pending.assignments);
      break;
    }

    default:
      break;
  }

  return {
    selectableCharacters,
    playableCards,
    moveNodes,
    targetCharacters,
    nodes,
    edges,
    statuses,
    deployNodes,
    deployAssignments,
    canUseSkill,
    skillArmed: pending.kind === 'SKILL',
    canConfirm: pendingAction !== null,
    pendingAction,
  };
}

/* ---------- 瞄准判定：用于"再点一次 = 执行" ---------- */

export function isArmedCharacter(ui: UiState, id: CharacterId): boolean {
  const pending = ui.pending;
  if (pending.kind === 'ATTACK' || pending.kind === 'SKILL' || pending.kind === 'CARD') {
    return pending.targetId === id;
  }
  return false;
}

export function isArmedNode(ui: UiState, vertex: VertexId): boolean {
  const pending = ui.pending;
  if (pending.kind === 'MOVE' || pending.kind === 'SKILL') return pending.to === vertex;
  if (pending.kind === 'CARD') return pending.to === vertex || pending.vertex === vertex;
  return false;
}

export function isArmedEdge(ui: UiState, edge: EdgeKey): boolean {
  return ui.pending.kind === 'CARD' && ui.pending.edge === edge;
}

export function isArmedStatus(ui: UiState, status: StatusType): boolean {
  return ui.pending.kind === 'CARD' && ui.pending.status === status;
}

/* ---------- 点击处理 ---------- */

/** 点击角色：技能瞄准态 → 技能目标；否则可攻击目标 → 普攻；否则己方角色 → 选中。 */
export function clickCharacter(
  ui: UiState,
  highlights: UiHighlights,
  characterId: CharacterId,
): UiState {
  const pending = ui.pending;
  if (highlights.targetCharacters.has(characterId)) {
    if (pending.kind === 'ATTACK') return { ...ui, pending: { ...pending, targetId: characterId } };
    if (pending.kind === 'SKILL') return { ...ui, pending: { ...pending, targetId: characterId } };
    if (pending.kind === 'CARD') return { ...ui, pending: { ...pending, targetId: characterId } };
    if (pending.kind === 'IDLE' && ui.selectedCharacterId !== null) {
      return {
        ...ui,
        pending: {
          kind: 'ATTACK',
          characterId: ui.selectedCharacterId,
          targetId: characterId,
        },
      };
    }
  }
  // 再点一次已经选中的角色 = 取消选中（详情随之收起）
  if (characterId === ui.selectedCharacterId) {
    return INITIAL_UI_STATE;
  }
  if (highlights.selectableCharacters.has(characterId)) {
    return { selectedCharacterId: characterId, pending: { kind: 'IDLE' } };
  }
  return ui;
}

/** 点击节点：技能/手牌的落点、移动落点、陷阱节点。 */
export function clickNode(ui: UiState, highlights: UiHighlights, vertex: VertexId): UiState {
  const pending = ui.pending;
  if (pending.kind === 'CARD') {
    if (highlights.moveNodes.has(vertex)) return { ...ui, pending: { ...pending, to: vertex } };
    if (highlights.nodes.has(vertex)) return { ...ui, pending: { ...pending, vertex } };
    return ui;
  }
  if (pending.kind === 'SKILL') {
    return highlights.moveNodes.has(vertex) ? { ...ui, pending: { ...pending, to: vertex } } : ui;
  }
  if (pending.kind === 'MOVE') {
    return highlights.moveNodes.has(vertex) ? { ...ui, pending: { ...pending, to: vertex } } : ui;
  }
  if (pending.kind === 'IDLE' && ui.selectedCharacterId !== null) {
    if (!highlights.moveNodes.has(vertex)) return ui;
    return { ...ui, pending: { kind: 'MOVE', characterId: ui.selectedCharacterId, to: vertex } };
  }
  return ui;
}

/** 点击边（封路）。 */
export function clickEdge(ui: UiState, highlights: UiHighlights, edge: EdgeKey): UiState {
  const pending = ui.pending;
  if (pending.kind === 'CARD' && highlights.edges.has(edge)) {
    return { ...ui, pending: { ...pending, edge } };
  }
  return ui;
}

/** 点击状态（净化）。 */
export function clickStatus(ui: UiState, highlights: UiHighlights, status: StatusType): UiState {
  const pending = ui.pending;
  if (pending.kind === 'CARD' && highlights.statuses.has(status)) {
    return { ...ui, pending: { ...pending, status } };
  }
  return ui;
}

/** 技能圆钮：进入 / 退出技能瞄准态。 */
export function armSkill(ui: UiState): UiState {
  const characterId = ui.selectedCharacterId;
  if (characterId === null) return ui;
  if (ui.pending.kind === 'SKILL') return { ...ui, pending: { kind: 'IDLE' } };
  return { ...ui, pending: { kind: 'SKILL', characterId, targetId: null, to: null } };
}

/** 选择一张手牌；再点同一张 = 取消选中。 */
export function selectCard(ui: UiState, handCardId: string, cardId: CardId): UiState {
  if (ui.pending.kind === 'CARD' && ui.pending.handCardId === handCardId) {
    return INITIAL_UI_STATE;
  }
  return {
    selectedCharacterId: null,
    pending: {
      kind: 'CARD',
      handCardId,
      cardId,
      targetId: null,
      to: null,
      edge: null,
      vertex: null,
      status: null,
    },
  };
}

export function selectPass(ui: UiState): UiState {
  return { ...ui, pending: { kind: 'PASS' } };
}

export function selectDiscard(_ui: UiState, handCardId: string): UiState {
  return { selectedCharacterId: null, pending: { kind: 'DISCARD', handCardId } };
}

export function resetSelection(): UiState {
  return INITIAL_UI_STATE;
}

/** 部署：选中一个还没放置的角色。 */
export function selectDeployCharacter(ui: UiState, characterId: CharacterId): UiState {
  return {
    selectedCharacterId: characterId,
    pending: ui.pending.kind === 'DEPLOY' ? ui.pending : { kind: 'DEPLOY', assignments: [] },
  };
}

/** 部署：把角色放到节点上（再次点击同一节点表示撤下）。 */
export function placeDeployCharacter(
  ui: UiState,
  characterId: CharacterId,
  vertex: VertexId,
): UiState {
  const pending =
    ui.pending.kind === 'DEPLOY' ? ui.pending : { kind: 'DEPLOY' as const, assignments: [] };
  const others = pending.assignments.filter(
    (item) => item.characterId !== characterId && item.vertex !== vertex,
  );
  const existing = pending.assignments.find((item) => item.characterId === characterId);
  const assignments =
    existing !== undefined && existing.vertex === vertex
      ? others
      : [...others, { characterId, vertex }];
  return { selectedCharacterId: characterId, pending: { kind: 'DEPLOY', assignments } };
}

/** 当前该做什么（由 i18n 翻译成提示语）。 */
export function promptFor(ui: UiState, highlights: UiHighlights): PromptCode {
  const pending = ui.pending;
  switch (pending.kind) {
    case 'IDLE':
      return ui.selectedCharacterId === null ? 'SELECT_CHARACTER' : 'SELECT_TARGET_OR_DESTINATION';
    case 'MOVE':
      return pending.to === null ? 'SELECT_DESTINATION' : 'READY_TO_EXECUTE';
    case 'ATTACK':
      return pending.targetId === null ? 'SELECT_TARGET' : 'READY_TO_EXECUTE';
    case 'SKILL':
      if (highlights.canConfirm) return 'READY_TO_EXECUTE';
      if (highlights.targetCharacters.size > 0) return 'SELECT_TARGET';
      if (highlights.moveNodes.size > 0) return 'SELECT_DESTINATION';
      return 'IDLE';
    case 'CARD':
      if (highlights.canConfirm) return 'READY_TO_EXECUTE';
      if (highlights.statuses.size > 0) return 'SELECT_STATUS';
      if (highlights.targetCharacters.size > 0) return 'SELECT_TARGET';
      if (highlights.edges.size > 0) return 'SELECT_EDGE';
      if (highlights.moveNodes.size > 0) return 'SELECT_DESTINATION';
      return 'SELECT_NODE';
    case 'PASS':
      return highlights.canConfirm ? 'READY_TO_CONFIRM' : 'IDLE';
    case 'DISCARD':
      return highlights.canConfirm ? 'READY_TO_CONFIRM' : 'IDLE';
    case 'DEPLOY':
      if (highlights.canConfirm) return 'DEPLOY_READY';
      return 'DEPLOY_SELECT_NODE';
    default:
      return 'IDLE';
  }
}

/** 确认按钮：返回要提交的 Action（不可确认时返回 null）。 */
export function confirmAction(highlights: UiHighlights): Action | null {
  return highlights.pendingAction;
}

/* ---------- 内部工具 ---------- */

function skillChoicesFor(legalActions: readonly Action[], characterId: CharacterId): SkillChoice[] {
  return legalActions
    .filter(
      (action): action is Extract<Action, { type: 'USE_SKILL' }> =>
        action.type === 'USE_SKILL' && action.characterId === characterId,
    )
    .map((action) => action.choice);
}

function cardChoicesFor(legalActions: readonly Action[], handCardId: string): CardChoice[] {
  return legalActions
    .filter(
      (action): action is Extract<Action, { type: 'USE_CARD' }> =>
        action.type === 'USE_CARD' && action.handCardId === handCardId,
    )
    .map((action) => action.choice);
}

function findSkillAction(
  legalActions: readonly Action[],
  characterId: CharacterId,
  choice: SkillChoice,
): Action | null {
  return (
    legalActions.find(
      (action) =>
        action.type === 'USE_SKILL' &&
        action.characterId === characterId &&
        skillChoiceEquals(action.choice, choice),
    ) ?? null
  );
}

function findCardAction(
  legalActions: readonly Action[],
  handCardId: string,
  choice: CardChoice,
): Action | null {
  return (
    legalActions.find(
      (action) =>
        action.type === 'USE_CARD' &&
        action.handCardId === handCardId &&
        cardChoiceEquals(action.choice, choice),
    ) ?? null
  );
}

function findDeployAction(
  legalActions: readonly Action[],
  assignments: readonly DeploymentAssignment[],
): Action | null {
  return (
    legalActions.find((action) => {
      if (action.type !== 'DEPLOY') return false;
      if (action.assignments.length !== assignments.length) return false;
      return assignments.every((mine) =>
        action.assignments.some(
          (theirs) => theirs.characterId === mine.characterId && theirs.vertex === mine.vertex,
        ),
      );
    }) ?? null
  );
}

/** 候选是否已经把参数说完了（没说就还需要玩家继续点）。 */
function isSkillChoiceComplete(
  choice: SkillChoice,
  pending: Extract<PendingAction, { kind: 'SKILL' }>,
): boolean {
  if (choice.kind === 'NONE') return true;
  if (choice.kind === 'SINGLE_TARGET') return pending.targetId !== null;
  if (choice.kind === 'MOVE_THEN_STRIKE') return pending.to !== null;
  return false;
}

function isCardChoiceComplete(
  choice: CardChoice,
  pending: Extract<PendingAction, { kind: 'CARD' }>,
): boolean {
  switch (choice.kind) {
    case 'SINGLE_TARGET':
      if (pending.targetId === null) return false;
      return choice.status === undefined || pending.status !== null;
    case 'MOVE_TO':
      return pending.targetId !== null && pending.to !== null;
    case 'EDGE':
      return pending.edge !== null;
    case 'VERTEX':
      return pending.vertex !== null;
    default:
      return false;
  }
}

function skillChoiceEquals(a: SkillChoice, b: SkillChoice): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'SINGLE_TARGET' && b.kind === 'SINGLE_TARGET') return a.targetId === b.targetId;
  if (a.kind === 'MOVE_THEN_STRIKE' && b.kind === 'MOVE_THEN_STRIKE') return a.to === b.to;
  return true;
}

function cardChoiceEquals(a: CardChoice, b: CardChoice): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'SINGLE_TARGET':
      return b.kind === 'SINGLE_TARGET' && a.targetId === b.targetId && a.status === b.status;
    case 'MOVE_TO':
      return b.kind === 'MOVE_TO' && a.targetId === b.targetId && a.to === b.to;
    case 'EDGE':
      return b.kind === 'EDGE' && a.edge === b.edge;
    case 'VERTEX':
      return b.kind === 'VERTEX' && a.vertex === b.vertex;
    default:
      return false;
  }
}

function matchesSkillPartial(
  choice: SkillChoice,
  pending: Extract<PendingAction, { kind: 'SKILL' }>,
): boolean {
  if (pending.targetId !== null) {
    if (choice.kind !== 'SINGLE_TARGET' || choice.targetId !== pending.targetId) return false;
  }
  if (pending.to !== null) {
    if (choice.kind !== 'MOVE_THEN_STRIKE' || choice.to !== pending.to) return false;
  }
  return true;
}

function matchesCardPartial(
  choice: CardChoice,
  pending: Extract<PendingAction, { kind: 'CARD' }>,
): boolean {
  if (pending.targetId !== null) {
    if (choice.kind !== 'SINGLE_TARGET' && choice.kind !== 'MOVE_TO') return false;
    if (choice.targetId !== pending.targetId) return false;
  }
  if (pending.to !== null) {
    if (choice.kind !== 'MOVE_TO' || choice.to !== pending.to) return false;
  }
  if (pending.edge !== null) {
    if (choice.kind !== 'EDGE' || choice.edge !== pending.edge) return false;
  }
  if (pending.vertex !== null) {
    if (choice.kind !== 'VERTEX' || choice.vertex !== pending.vertex) return false;
  }
  if (pending.status !== null) {
    if (choice.kind !== 'SINGLE_TARGET' || choice.status !== pending.status) return false;
  }
  return true;
}

function collectCardChoice(
  choice: CardChoice,
  pending: Extract<PendingAction, { kind: 'CARD' }>,
  targetCharacters: Set<CharacterId>,
  moveNodes: Set<VertexId>,
  nodes: Set<VertexId>,
  edges: Set<EdgeKey>,
  statuses: Set<StatusType>,
): void {
  switch (choice.kind) {
    case 'SINGLE_TARGET':
      if (pending.targetId === null) targetCharacters.add(choice.targetId);
      else if (pending.status === null && choice.status !== undefined) statuses.add(choice.status);
      break;
    case 'MOVE_TO':
      if (pending.targetId === null) targetCharacters.add(choice.targetId);
      else moveNodes.add(choice.to);
      break;
    case 'EDGE':
      edges.add(choice.edge);
      break;
    case 'VERTEX':
      nodes.add(choice.vertex);
      break;
    default:
      break;
  }
}

/** 部署：随机选一个合法方案（开发用）。 */
export function randomDeployAction(
  legalActions: readonly Action[],
  randomIndex: number,
): Action | null {
  const deployActions = legalActions.filter((action) => action.type === 'DEPLOY');
  if (deployActions.length === 0) return null;
  return deployActions[randomIndex % deployActions.length] as Action;
}
