/**
 * UI 与引擎之间的唯一通道。
 *
 * UI 不直接读写 GameState：它只拿 PlayerView 与"你的合法行动列表"，只提交 Action。
 * 因此 Phase 7 的联机版本只需要换掉这里的实现（WebSocket），UI 层不用改动。
 */

import type { Action } from '../core/Action';
import {
  applyAction,
  createGameFromSeed,
  getLegalActions,
  isFinished,
  validateAction,
} from '../core/GameEngine';
import type { GameState, PlayerId } from '../core/GameState';
import type { GameEvent } from '../core/Event';
import { getViewFor, type PlayerView } from '../core/View';
import { hashState } from '../core/hash';
import { parseRecord, serializeRecord, type GameRecord } from './replay';

/** 回放进度：当前第几步 / 总共几步。 */
export interface ReplayStatus {
  readonly step: number;
  readonly total: number;
}

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
  /** 是否可以悔棋（本地对局限定）。 */
  readonly canUndo: boolean;
  /** 正在回放时的进度；null 表示这是一局正常对局。 */
  readonly replay: ReplayStatus | null;
  /** 当前这一局的记录（JSON 文本，可以直接复制分享）。 */
  readonly record: string;
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
  /** 回退一步（本地对局的便利功能，不是游戏规则）。 */
  undo(): void;
  /** 载入一段记录并从头开始回放；文本不合法时返回 false。 */
  loadRecord(text: string): boolean;
  /** 回放：前进一步 / 后退一步（不在回放时什么都不做）。 */
  replayStep(): void;
  replayBack(): void;
  /** 结束回放：停在当前画面，把这一局变回可以正常操作的当前局面。 */
  stopReplay(): void;
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
  /** 本局已提交的行动（配合种子就能完整重放）。 */
  let history: Action[] = [];
  let seeds = {
    mapSeed: options.mapSeed,
    gameSeed: options.gameSeed,
    maxTurns: options.maxTurns ?? null,
  };
  /** 非 null 表示正在按一份记录回放。 */
  let replay: { record: GameRecord; step: number } | null = null;
  let lastEvents: readonly GameEvent[] = [];
  let eventSeq = 0;
  /** 悔棋用的状态栈（只保留最近若干步）。 */
  const past: GameState[] = [];
  const UNDO_LIMIT = 80;
  const listeners = new Set<() => void>();
  let snapshot = buildSnapshot();

  function buildSnapshot(): GameSnapshot {
    const effectiveViewer = viewer ?? state.currentPlayer;
    const record: GameRecord = replay?.record ?? {
      version: 1,
      mapSeed: seeds.mapSeed,
      gameSeed: seeds.gameSeed,
      maxTurns: seeds.maxTurns,
      actions: history.slice(),
    };
    return {
      view: getViewFor(state, effectiveViewer),
      legalActions: isFinished(state) ? [] : getLegalActions(state),
      finished: isFinished(state),
      stateHash: hashState(state),
      viewer: effectiveViewer,
      lastEvents,
      eventSeq,
      canUndo: past.length > 0,
      replay: replay === null ? null : { step: replay.step, total: replay.record.actions.length },
      record: serializeRecord(record),
    };
  }

  function publish(): void {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  }

  function dispatch(action: Action): void {
    try {
      const result = applyAction(state, action);
      past.push(state);
      if (past.length > UNDO_LIMIT) past.shift();
      state = result.state;
      if (replay === null) history.push(action);
      lastEvents = result.events;
      eventSeq += 1;
    } catch (error) {
      // UI 只会提交合法行动；能走到这里说明是开发时用错了接口
      console.error('无法执行的行动', action, error);
      return;
    }
    publish();
  }

  function setViewer(next: PlayerId | null): void {
    viewer = next;
    publish();
  }

  function undo(): void {
    const previous = past.pop();
    if (previous === undefined) return;
    state = previous;
    if (replay === null) history.pop();
    else replay = { record: replay.record, step: Math.max(0, replay.step - 1) };
    lastEvents = [];
    eventSeq += 1;
    publish();
  }

  function startNewGame(next: NewGameOptions): void {
    past.length = 0;
    history = [];
    replay = null;
    seeds = {
      mapSeed: next.mapSeed,
      gameSeed: next.gameSeed,
      maxTurns: next.maxTurns ?? null,
    };
    state = createGameFromSeed({
      mapSeed: next.mapSeed,
      gameSeed: next.gameSeed,
      maxTurns: next.maxTurns ?? null,
    });
    lastEvents = [];
    eventSeq += 1;
    publish();
  }

  function loadRecord(text: string): boolean {
    const record = parseRecord(text);
    if (record === null) return false;
    past.length = 0;
    history = [];
    seeds = {
      mapSeed: record.mapSeed,
      gameSeed: record.gameSeed,
      maxTurns: record.maxTurns,
    };
    state = createGameFromSeed({
      mapSeed: record.mapSeed,
      gameSeed: record.gameSeed,
      maxTurns: record.maxTurns,
    });
    replay = { record, step: 0 };
    lastEvents = [];
    eventSeq += 1;
    publish();
    return true;
  }

  function replayStep(): void {
    if (replay === null || replay.step >= replay.record.actions.length) return;
    const action = replay.record.actions[replay.step] as Action;
    // 记录与当前局面不符（比如中途被手动改过）就停在这儿，不要抛错
    if (!validateAction(state, action).ok) {
      console.warn('回放中断：行动与当前局面不符', replay.step, action);
      return;
    }
    replay = { record: replay.record, step: replay.step + 1 };
    dispatch(action);
  }

  function stopReplay(): void {
    if (replay === null) return;
    // 停在当前画面上，把已经放过的部分变成"这一局的记录"，之后可以继续正常操作
    history = replay.record.actions.slice(0, replay.step);
    replay = null;
    publish();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
    setViewer,
    undo,
    startNewGame,
    loadRecord,
    replayStep,
    replayBack: undo,
    stopReplay,
  };
}
