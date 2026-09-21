/**
 * UI 与引擎之间的唯一通道。
 *
 * UI 不直接读写 GameState：它只拿 PlayerView 与"你的合法行动列表"，只提交 Action。
 * 因此 Phase 7 的联机版本只需要换掉这里的实现（WebSocket），UI 层不用改动。
 */

import type { Action } from '../core/Action';
import { applyAction, createGameFromSeed, getLegalActions, isFinished } from '../core/GameEngine';
import type { GameState, PlayerId } from '../core/GameState';
import type { GameEvent } from '../core/Event';
import { getViewFor, type PlayerView } from '../core/View';
import { hashState } from '../core/hash';

export interface GameSnapshot {
  /** 当前视角下可见的状态。 */
  readonly view: PlayerView;
  /** 当前行动方的全部合法行动（UI 的高亮全部由它推导）。 */
  readonly legalActions: readonly Action[];
  readonly finished: boolean;
  /** 便于调试与复现的状态哈希。 */
  readonly stateHash: string;
  /** 实际生效的视角。 */
  readonly viewer: PlayerId;
  /** 最近一次行动产生的事件（界面用来播动画）；seq 单调递增。 */
  readonly lastEvents: readonly GameEvent[];
  readonly eventSeq: number;
}

export interface NewGameOptions {
  readonly mapSeed: string;
  readonly gameSeed: string;
  readonly maxTurns?: number | null;
}

export interface GameTransport {
  getSnapshot(): GameSnapshot;
  subscribe(listener: () => void): () => void;
  dispatch(action: Action): void;
  /** null 表示跟随当前行动方（同屏轮流用）。 */
  setViewer(viewer: PlayerId | null): void;
  startNewGame(options: NewGameOptions): void;
}

export interface LocalTransportOptions extends NewGameOptions {
  readonly viewer?: PlayerId | null;
}

/** 单机实现：状态就存在内存里。 */
export function createLocalTransport(options: LocalTransportOptions): GameTransport {
  let state: GameState = createGameFromSeed({
    mapSeed: options.mapSeed,
    gameSeed: options.gameSeed,
    maxTurns: options.maxTurns ?? null,
  });
  let viewer: PlayerId | null = options.viewer ?? null;
  let lastEvents: readonly GameEvent[] = [];
  let eventSeq = 0;
  const listeners = new Set<() => void>();
  let snapshot = buildSnapshot();

  function buildSnapshot(): GameSnapshot {
    const effectiveViewer = viewer ?? state.currentPlayer;
    return {
      view: getViewFor(state, effectiveViewer),
      legalActions: isFinished(state) ? [] : getLegalActions(state),
      finished: isFinished(state),
      stateHash: hashState(state),
      viewer: effectiveViewer,
      lastEvents,
      eventSeq,
    };
  }

  function publish(): void {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action: Action): void {
      try {
        const result = applyAction(state, action);
        state = result.state;
        lastEvents = result.events;
        eventSeq += 1;
      } catch (error) {
        // UI 只会提交合法行动；能走到这里说明是开发时的用错了接口
        console.error('无法执行的行动', action, error);
        return;
      }
      publish();
    },
    setViewer(next: PlayerId | null): void {
      viewer = next;
      publish();
    },
    startNewGame(next: NewGameOptions): void {
      state = createGameFromSeed({
        mapSeed: next.mapSeed,
        gameSeed: next.gameSeed,
        maxTurns: next.maxTurns ?? null,
      });
      publish();
    },
  };
}
