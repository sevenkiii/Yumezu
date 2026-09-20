/**
 * 测试专用夹具：快速搭出可复现的中局状态。
 *
 * 这里允许直接改写状态（引擎本身不允许），因为测试需要精确控制局面。
 */

import { createCharacter } from '../../src/characters/Character';
import type { Action } from '../../src/core/Action';
import { applyAction, createGame, getLegalActions } from '../../src/core/GameEngine';
import type {
  CardId,
  CharacterId,
  CharacterTypeId,
  GameState,
  PlayerId,
  VertexId,
} from '../../src/core/GameState';
import { findCharacter } from '../../src/core/GameState';
import { PHASE1_MAP, PHASE1_SPAWN_CENTERS } from '../../src/map/fixtures';

export interface BattleSetup {
  readonly p1?: readonly CharacterTypeId[];
  readonly p2?: readonly CharacterTypeId[];
  /** 角色 id（形如 "P2:Mikage"）到节点的映射。 */
  readonly positions?: Record<CharacterId, VertexId>;
  readonly hands?: { readonly P1?: readonly CardId[]; readonly P2?: readonly CardId[] };
  readonly currentPlayer?: PlayerId;
  readonly gameSeed?: string;
}

export function createBattleState(setup: BattleSetup = {}): GameState {
  let state = createGame({
    mapSeed: 'test-map',
    gameSeed: setup.gameSeed ?? 'test-game',
    graph: PHASE1_MAP,
    spawnCenters: { P1: PHASE1_SPAWN_CENTERS.P1, P2: PHASE1_SPAWN_CENTERS.P2 },
  });
  state = deployAuto(state);

  if (setup.p1 !== undefined && setup.p2 !== undefined) {
    state.characters = [];
    state.roster = { P1: setup.p1.slice(), P2: setup.p2.slice() };
    for (const typeId of setup.p1) {
      state.characters.push(createCharacter('P1', typeId, state.spawn.P1.center));
    }
    for (const typeId of setup.p2) {
      state.characters.push(createCharacter('P2', typeId, state.spawn.P2.center));
    }
  }

  if (setup.positions !== undefined) {
    for (const [id, vertex] of Object.entries(setup.positions)) {
      const character = findCharacter(state, id);
      if (character === null) throw new Error('fixtures: 未知角色 ' + id);
      character.position = vertex;
    }
  }

  if (setup.hands !== undefined) {
    setHand(state, 'P1', setup.hands.P1 ?? []);
    setHand(state, 'P2', setup.hands.P2 ?? []);
  }

  if (setup.currentPlayer !== undefined) state.currentPlayer = setup.currentPlayer;
  state.phase = 'BATTLE';
  return state;
}

export function setHand(state: GameState, player: PlayerId, cards: readonly CardId[]): void {
  const owner = state.players[player];
  owner.hand = [];
  owner.nextCardSeq = 0;
  for (const cardId of cards) {
    owner.hand.push({ id: player + '-C' + owner.nextCardSeq, cardId });
    owner.nextCardSeq += 1;
  }
}

/** 双方都用第一个合法部署提交，直接进入战斗阶段。 */
export function deployAuto(state: GameState): GameState {
  let current = state;
  while (current.phase === 'DEPLOY') {
    const actions = getLegalActions(current);
    const first = actions[0] as Action;
    current = applyAction(current, first).state;
  }
  return current;
}

/** 让指定的角色受到伤害（测试用）。 */
export function damageForTest(state: GameState, id: CharacterId, amount: number): void {
  const character = findCharacter(state, id);
  if (character === null) throw new Error('fixtures: 未知角色 ' + id);
  character.hp = Math.max(0, character.hp - amount);
  if (character.hp === 0) character.alive = false;
}
