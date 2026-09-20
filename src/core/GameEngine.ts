/**
 * 引擎入口：S(t+1) = F(S(t), A(t))。见 RULES.md「总原则」与「核心架构」。
 *
 * 对外协议：
 *  - createGame：构造初始状态（含随机阵容、开局手牌、先手）。
 *  - validateAction：纯查询，返回结构化结果，不抛异常。
 *  - applyAction：校验后结算；传入非法 Action 时抛 EngineError（调用方应先 validate）。
 *  - getLegalActions：枚举当前玩家的全部合法行动。
 *
 * 状态不可变：applyAction 先克隆状态，返回全新的 GameState，绝不修改入参。
 */

import { cardDefinition } from '../cards/Card';
import { removeCardFromHand } from '../cards/CardPool';
import { characterDefinition } from '../characters/Character';
import type { Graph } from '../map/Graph';
import { computeSpawnInfo } from '../map/SpawnGenerator';
import type { ValidationResult } from '../rules/ActionRules';
import {
  getLegalActions as enumerateLegalActions,
  validateActionInternal,
} from '../rules/ActionRules';
import { resolveEffects } from '../rules/EffectResolver';
import {
  beginTurn,
  checkGameEnd,
  endTurn,
  initialiseHands,
  initialiseRoster,
  pruneExpiredBlocks,
} from '../rules/TurnRules';
import { actingCharacterId, type Action } from './Action';
import type { GameEvent } from './Event';
import type { CharacterState, Deployment, GameState, PlayerId, VertexId } from './GameState';
import { PLAYER_IDS, findCharacter, opponentOf } from './GameState';
import { createRngStreams, nextIndex } from './RNG';

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

export interface CreateGameOptions {
  /** 只用于地图与出生点；Phase 1 中由调用方直接提供固定地图。 */
  readonly mapSeed: string;
  /** 用于阵容、先手与抽牌。 */
  readonly gameSeed: string;
  readonly graph: Graph;
  readonly spawnCenters: Record<PlayerId, VertexId>;
  /** 可选回合上限；省略表示不设上限。 */
  readonly maxTurns?: number | null;
}

export function createGame(options: CreateGameOptions): GameState {
  const rng = createRngStreams(options.gameSeed);
  const first = nextIndex(rng.firstPlayer, PLAYER_IDS.length);
  rng.firstPlayer = first.next;
  const firstPlayer = PLAYER_IDS[first.value] as PlayerId;

  const state: GameState = {
    config: { maxTurns: options.maxTurns ?? null },
    mapSeed: options.mapSeed,
    gameSeed: options.gameSeed,
    map: { graph: options.graph, blockedEdges: [], traps: [], nextTrapSeq: 0 },
    spawn: computeSpawnInfo(options.graph, options.spawnCenters),
    roster: { P1: [], P2: [] },
    characters: [],
    players: {
      P1: { id: 'P1', hand: [], nextCardSeq: 0 },
      P2: { id: 'P2', hand: [], nextCardSeq: 0 },
    },
    deployment: { P1: null, P2: null },
    phase: 'DEPLOY',
    currentPlayer: 'P1',
    firstPlayer,
    turnIndex: 0,
    rng,
    history: [],
    result: null,
  };

  const ignored: GameEvent[] = [];
  initialiseRoster(state, ignored);
  initialiseHands(state, ignored);
  return state;
}

/** 深拷贝状态。GameState 全部是可序列化的纯数据，因此 structuredClone 足够。 */
export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

/** 纯查询：先清掉已到期的封锁，再校验。 */
export function validateAction(state: GameState, action: Action): ValidationResult {
  const draft = cloneState(state);
  pruneExpiredBlocks(draft, []);
  return validateActionInternal(draft, action);
}

/** 当前玩家的全部合法行动。 */
export function getLegalActions(state: GameState): Action[] {
  if (state.phase === 'FINISHED') return [];
  const draft = cloneState(state);
  pruneExpiredBlocks(draft, []);
  return enumerateLegalActions(draft);
}

export function isFinished(state: GameState): boolean {
  return state.phase === 'FINISHED';
}

export function applyAction(
  state: GameState,
  action: Action,
): { state: GameState; events: GameEvent[] } {
  const draft = cloneState(state);
  const events: GameEvent[] = [];

  pruneExpiredBlocks(draft, events);
  const validation = validateActionInternal(draft, action);
  if (!validation.ok) {
    throw new EngineError('非法行动 [' + validation.code + ']：' + validation.reason);
  }

  if (action.type === 'DEPLOY') {
    performDeployment(draft, action, events);
  } else {
    consumeActingStatuses(draft, action, events);
    performBattleAction(draft, action, events);
    checkGameEnd(draft, events);
    if (draft.phase === 'BATTLE') endTurn(draft, events);
  }

  draft.history.push({ action, events });
  return { state: draft, events };
}

/** 提交部署；双方都提交后同时公开并进入战斗阶段。 */
function performDeployment(
  state: GameState,
  action: Extract<Action, { type: 'DEPLOY' }>,
  events: GameEvent[],
): void {
  state.deployment[action.player] = {
    assignments: action.assignments.map((item) => ({ ...item })),
  };
  events.push({ type: 'DEPLOY_SUBMITTED', player: action.player });

  const other = opponentOf(action.player);
  if (state.deployment[other] === null) {
    state.currentPlayer = other;
    return;
  }

  for (const player of PLAYER_IDS) {
    const deployment = state.deployment[player];
    if (deployment === null) continue;
    for (const assignment of deployment.assignments) {
      const character = findCharacter(state, assignment.characterId);
      if (character !== null) character.position = assignment.vertex;
    }
  }
  events.push({
    type: 'DEPLOY_REVEALED',
    deployment: {
      P1: state.deployment.P1 as Deployment,
      P2: state.deployment.P2 as Deployment,
    },
  });

  state.phase = 'BATTLE';
  state.currentPlayer = state.firstPlayer;
  state.turnIndex = 0;
  beginTurn(state, state.firstPlayer, events);
}

/**
 * 被选为行动角色时消耗「冻结 / 封技」。
 * 注意：使用功能牌的行动不会选中任何角色，因此不会消耗这两种状态。
 */
function consumeActingStatuses(state: GameState, action: Action, events: GameEvent[]): void {
  const id = actingCharacterId(action);
  if (id === null) return;
  const character = findCharacter(state, id);
  if (character === null) return;
  if (character.statuses.Frozen) {
    character.statuses.Frozen = false;
    events.push({ type: 'STATUS_REMOVED', targetId: character.id, status: 'Frozen' });
  }
  if (character.statuses.SkillSealed) {
    character.statuses.SkillSealed = false;
    events.push({ type: 'STATUS_REMOVED', targetId: character.id, status: 'SkillSealed' });
  }
}

function performBattleAction(state: GameState, action: Action, events: GameEvent[]): void {
  switch (action.type) {
    case 'MOVE': {
      events.push(
        ...resolveEffects(state, [
          { kind: 'RELOCATE', targetId: action.characterId, to: action.to, cause: 'MOVE' },
        ]),
      );
      return;
    }
    case 'ATTACK': {
      const attacker = findCharacter(state, action.characterId) as CharacterState;
      events.push(
        ...resolveEffects(state, [
          {
            kind: 'DAMAGE',
            targetId: action.targetId,
            amount: attacker.attackDamage,
            source: {
              kind: 'ATTACK',
              sourceCharacterId: attacker.id,
              sourcePlayerId: attacker.owner,
            },
          },
        ]),
      );
      return;
    }
    case 'USE_SKILL': {
      const character = findCharacter(state, action.characterId) as CharacterState;
      const definition = characterDefinition(character.typeId);
      character.skillCd = definition.skill.cd;
      events.push(
        ...resolveEffects(state, definition.skill.buildEffects(state, character, action.choice)),
      );
      return;
    }
    case 'USE_CARD': {
      const card = removeCardFromHand(state, action.player, action.handCardId);
      if (card === null) return;
      const definition = cardDefinition(card.cardId);
      events.push(
        ...resolveEffects(state, definition.buildEffects(state, action.player, action.choice)),
      );
      return;
    }
    case 'DISCARD': {
      const card = removeCardFromHand(state, action.player, action.handCardId);
      if (card !== null) {
        events.push({ type: 'CARD_DISCARDED', player: action.player, cardId: card.cardId });
      }
      return;
    }
    case 'PASS':
    default:
      return;
  }
}
