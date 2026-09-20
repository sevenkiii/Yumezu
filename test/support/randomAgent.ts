/**
 * 随机合法行动决策器：Phase 1 用它跑完整对局（不是正式 AI）。
 *
 * 决策本身也走注入的 RNG，因此同一个 seed 可以完整复现整局。
 */

import type { Action } from '../../src/core/Action';
import { applyAction, getLegalActions, isFinished } from '../../src/core/GameEngine';
import type { GameState } from '../../src/core/GameState';
import { createRngStream, nextIndex } from '../../src/core/RNG';

export interface Agent {
  pick(state: GameState): Action;
}

/**
 * 大部分时候优先选择进攻性行动（攻击 / 专属技能 / 功能牌）。
 * 纯粹均匀随机会被大量「移动 / 瞬步 / 陷阱」选项淹没，导致对局几乎不可能分出胜负；
 * 这个倾向让 Phase 1 的 demo 能跑出真正的击杀，同时保持完全确定性。
 */
export function createRandomAgent(seed: string): Agent {
  let stream = createRngStream(seed, 'cards');
  return {
    pick(state: GameState): Action {
      const actions = getLegalActions(state);
      if (actions.length === 0) throw new Error('randomAgent: 没有合法行动');

      const roll = nextIndex(stream, 100);
      stream = roll.next;
      const preferAggressive = roll.value < 70;
      const aggressive = actions.filter(isAggressive);
      const pool = preferAggressive && aggressive.length > 0 ? aggressive : actions;

      const choose = nextIndex(stream, pool.length);
      stream = choose.next;
      return pool[choose.value] as Action;
    },
  };
}

function isAggressive(action: Action): boolean {
  return action.type === 'ATTACK' || action.type === 'USE_SKILL' || action.type === 'USE_CARD';
}

export interface GameLog {
  readonly state: GameState;
  readonly actionCount: number;
  readonly decisions: readonly string[];
}

/** 用给定决策器把一局跑完（或直到达到步数上限）。 */
export function playGame(initial: GameState, agent: Agent, maxActions = 5000): GameLog {
  let state = initial;
  let actionCount = 0;
  const decisions: string[] = [];
  while (!isFinished(state) && actionCount < maxActions) {
    const action = agent.pick(state);
    decisions.push(describeAction(action));
    state = applyAction(state, action).state;
    actionCount += 1;
  }
  return { state, actionCount, decisions };
}

export function describeAction(action: Action): string {
  switch (action.type) {
    case 'DEPLOY':
      return 'DEPLOY ' + action.player;
    case 'MOVE':
      return 'MOVE ' + action.characterId + ' -> ' + action.to;
    case 'ATTACK':
      return 'ATTACK ' + action.characterId + ' -> ' + action.targetId;
    case 'USE_SKILL':
      return 'SKILL ' + action.characterId + ' ' + action.choice.kind;
    case 'USE_CARD':
      return 'CARD ' + action.handCardId + ' ' + action.choice.kind;
    case 'DISCARD':
      return 'DISCARD ' + action.handCardId;
    case 'PASS':
      return 'PASS ' + action.player;
    default:
      return 'UNKNOWN';
  }
}
