/**
 * 权威对局：服务器手里这一局的全部真相。
 *
 * 纯逻辑、不碰网络——WebSocket 那层只负责把消息喂进来、把快照发出去，
 * 所以这里可以用内存直接跑完整局测试。
 */

import type { Action } from '../core/Action';
import type { GameEvent } from '../core/Event';
import {
  applyAction,
  createGameFromSeed,
  getLegalActions,
  isFinished,
  validateAction,
} from '../core/GameEngine';
import type { PlayerId } from '../core/GameState';
import { serializeRecord, type GameRecord } from '../core/Record';
import { getViewFor, type PlayerView } from '../core/View';
import { hashState } from '../core/hash';
import type { RoomSnapshot } from './protocol';

export interface GameSessionOptions {
  readonly roomId: string;
  readonly mapSeed: string;
  readonly gameSeed: string;
  readonly maxTurns?: number | null;
}

export type SubmitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'NOT_YOUR_TURN' | 'ILLEGAL_ACTION' | 'FINISHED' };

export interface GameSession {
  /** 某位玩家现在该看到的快照（已按座位裁剪）。 */
  snapshotFor(player: PlayerId): RoomSnapshot;
  /** 提交一个行动；只有轮到的那位能提交，非法行动会被拒。 */
  submit(player: PlayerId, action: Action): SubmitResult;
  /** 这一局结束了吗。 */
  finished(): boolean;
}

export function createGameSession(options: GameSessionOptions): GameSession {
  const maxTurns = options.maxTurns ?? null;
  let state = createGameFromSeed({
    mapSeed: options.mapSeed,
    gameSeed: options.gameSeed,
    maxTurns,
  });
  /** 单调递增：客户端靠它判断"来了新的一手"。 */
  let eventSeq = 0;
  const history: Action[] = [];

  function record(): string {
    const value: GameRecord = {
      version: 1,
      mapSeed: options.mapSeed,
      gameSeed: options.gameSeed,
      maxTurns,
      actions: history.slice(),
    };
    return serializeRecord(value);
  }

  function snapshotFor(player: PlayerId): RoomSnapshot {
    const done = isFinished(state);
    const acting = state.currentPlayer === player;
    return {
      roomId: options.roomId,
      seat: player,
      view: getViewFor(state, player),
      // 只有轮到的人拿得到合法行动：里面含手牌实例 id，发给对手等于泄露手牌
      legalActions: done || !acting ? [] : getLegalActions(state),
      finished: done,
      stateHash: hashState(state),
      eventSeq,
      record: record(),
    };
  }

  return {
    finished: () => isFinished(state),
    snapshotFor,
    submit(player: PlayerId, action: Action): SubmitResult {
      if (isFinished(state)) return { ok: false, code: 'FINISHED' };
      if (state.currentPlayer !== player) return { ok: false, code: 'NOT_YOUR_TURN' };
      if (!validateAction(state, action).ok) return { ok: false, code: 'ILLEGAL_ACTION' };
      state = applyAction(state, action).state;
      history.push(action);
      eventSeq += 1;
      return { ok: true };
    },
  };
}

/** 最近一手产生的公开事件（界面用它播动画）；没有就返回空数组。 */
export function latestEventsOf(view: PlayerView): readonly GameEvent[] {
  const last = view.recentTurns[view.recentTurns.length - 1];
  return last === undefined ? [] : last.events;
}
