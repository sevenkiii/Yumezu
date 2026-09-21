/**
 * 回合结构：开局初始化、回合开始 / 结束、胜负判定。见 RULES.md §7 与 §17。
 *
 * 本文件的函数会修改传入的 draft 状态，只允许引擎内部调用。
 */

import { INITIAL_HAND_SIZE, MAX_HAND_SIZE, drawCard } from '../cards/CardPool';
import { createCharacter } from '../characters/Character';
import type { GameEvent } from '../core/Event';
import type {
  Deployment,
  DeploymentAssignment,
  GameResult,
  GameState,
  PlayerId,
  VertexId,
} from '../core/GameState';
import { CHARACTER_TYPE_IDS, PLAYER_IDS, aliveCharactersOf, opponentOf } from '../core/GameState';
import { shuffled } from '../core/RNG';

/** 每方角色数量。 */
export const TEAM_SIZE = 3;

/** 双方各自等概率随机获得 3 名互不相同的角色（允许双方抽到同名角色）。 */
export function initialiseRoster(state: GameState, events: GameEvent[]): void {
  for (const player of PLAYER_IDS) {
    const roll = shuffled(state.rng.roster, CHARACTER_TYPE_IDS);
    state.rng.roster = roll.next;
    const picks = roll.value.slice(0, TEAM_SIZE);
    state.roster[player] = picks;
    for (const typeId of picks) {
      state.characters.push(createCharacter(player, typeId, state.spawn[player].center));
    }
  }
  events.push({ type: 'GAME_START', firstPlayer: state.firstPlayer, roster: state.roster });
}

/**
 * 核心随机部署：每名玩家在自己的出生区域内随机取 3 个不同节点。
 *
 * 使用 gameSeed 的 deploy 子流，因此同一组种子必然得到完全相同的站位。
 */
export function applyRandomDeployment(state: GameState, events: GameEvent[]): void {
  for (const player of PLAYER_IDS) {
    const region = state.spawn[player].region.slice().sort((a, b) => a - b);
    if (region.length < TEAM_SIZE) {
      throw new Error('出生区域只有 ' + region.length + ' 个节点，放不下 ' + TEAM_SIZE + ' 名角色');
    }

    const roll = shuffled(state.rng.deploy, region);
    state.rng.deploy = roll.next;
    const picks = roll.value.slice(0, TEAM_SIZE);
    const own = state.characters.filter((character) => character.owner === player);

    const assignments: DeploymentAssignment[] = [];
    own.forEach((character, index) => {
      const vertex = picks[index] as VertexId;
      character.position = vertex;
      assignments.push({ characterId: character.id, vertex });
    });

    state.deployment[player] = { assignments };
    events.push({ type: 'DEPLOY_SUBMITTED', player });
  }

  events.push({
    type: 'DEPLOY_REVEALED',
    deployment: {
      P1: state.deployment.P1 as Deployment,
      P2: state.deployment.P2 as Deployment,
    },
  });
}

/** 开局发牌：双方各 3 张。 */
export function initialiseHands(state: GameState, events: GameEvent[]): void {
  for (const player of PLAYER_IDS) {
    for (let i = 0; i < INITIAL_HAND_SIZE; i += 1) {
      const card = drawCard(state, player);
      events.push({
        type: 'CARD_DRAWN',
        player,
        cardId: card.cardId,
        handSize: state.players[player].hand.length,
      });
    }
  }
}

/** 清除已到期的封锁边（到达 expiresAtTurnIndex 时解除）。 */
export function pruneExpiredBlocks(state: GameState, events: GameEvent[]): void {
  const kept = [];
  for (const blocked of state.map.blockedEdges) {
    if (blocked.expiresAtTurnIndex <= state.turnIndex) {
      events.push({ type: 'EDGE_UNBLOCKED', edge: blocked.edge });
    } else {
      kept.push(blocked);
    }
  }
  state.map.blockedEdges = kept;
}

/** 回合开始：先递减 CD，再抽牌（手牌 < 5 时）。 */
export function beginTurn(state: GameState, player: PlayerId, events: GameEvent[]): void {
  events.push({ type: 'TURN_START', player, turnIndex: state.turnIndex });
  for (const character of state.characters) {
    if (character.owner !== player || !character.alive || character.skillCd <= 0) continue;
    const from = character.skillCd;
    character.skillCd = from - 1;
    events.push({
      type: 'COOLDOWN_TICKED',
      characterId: character.id,
      from,
      to: character.skillCd,
    });
  }
  const handSize = state.players[player].hand.length;
  if (handSize < MAX_HAND_SIZE) {
    const card = drawCard(state, player);
    events.push({
      type: 'CARD_DRAWN',
      player,
      cardId: card.cardId,
      handSize: state.players[player].hand.length,
    });
  }
}

/** 回合结束：推进 turnIndex，把行动权交给对手并开始其回合。 */
export function endTurn(state: GameState, events: GameEvent[]): void {
  state.turnIndex += 1;
  const next = opponentOf(state.currentPlayer);
  state.currentPlayer = next;
  const limit = state.config.maxTurns;
  if (limit !== null && state.turnIndex >= limit) {
    finishGame(state, { kind: 'DRAW', reason: 'TURN_LIMIT' }, events);
    return;
  }
  beginTurn(state, next, events);
}

/** 每次行动结算完成后检查胜负。 */
export function checkGameEnd(state: GameState, events: GameEvent[]): void {
  const aliveP1 = aliveCharactersOf(state, 'P1').length;
  const aliveP2 = aliveCharactersOf(state, 'P2').length;
  if (aliveP1 > 0 && aliveP2 > 0) return;
  if (aliveP1 === 0 && aliveP2 === 0) {
    finishGame(state, { kind: 'DRAW', reason: 'MUTUAL_ANNIHILATION' }, events);
    return;
  }
  const winner: PlayerId = aliveP1 > 0 ? 'P1' : 'P2';
  finishGame(state, { kind: 'WIN', winner, reason: 'ANNIHILATION' }, events);
}

export function finishGame(state: GameState, result: GameResult, events: GameEvent[]): void {
  if (state.phase === 'FINISHED') return;
  state.phase = 'FINISHED';
  state.result = result;
  events.push({ type: 'GAME_END', result });
}
