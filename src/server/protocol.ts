/**
 * 客户端 ↔ 服务端的消息（JSON 文本）。
 *
 * 服务端权威：客户端只能提交 `Action`，收到的快照里 View 已经按座位裁剪过
 * （对手手牌、抽牌/弃牌记录都看不到，见 `src/core/View.ts`）。
 */

import type { Action } from '../core/Action';
import type { PlayerId } from '../core/GameState';
import type { PlayerView } from '../core/View';

/** 协议版本：两边对不上就直接拒绝，免得用旧客户端打新服务端。 */
export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | {
      readonly type: 'hello';
      readonly version: number;
      readonly roomId: string;
      /** 上次拿到的重连凭据；第一次加入时为 null。 */
      readonly token: string | null;
    }
  | { readonly type: 'action'; readonly action: Action }
  | { readonly type: 'ping' };

/** 服务端发给某个座位的一份"这一局的现状"。 */
export interface RoomSnapshot {
  readonly roomId: string;
  readonly seat: PlayerId;
  readonly view: PlayerView;
  /**
   * 只有轮到这位玩家时才是非空——里面含 `USE_CARD` 的手牌实例 id，
   * 发给对手等于泄露手牌。
   */
  readonly legalActions: readonly Action[];
  readonly finished: boolean;
  readonly stateHash: string;
  /** 单调递增：客户端用它判断"来了新的一手"（0 表示刚连上，不播动画）。 */
  readonly eventSeq: number;
  /** 种子 + 行动序列，可用于复盘或断线重连。 */
  readonly record: string;
}

export type ServerErrorCode =
  'BAD_MESSAGE' | 'BAD_VERSION' | 'ROOM_FULL' | 'NOT_YOUR_TURN' | 'ILLEGAL_ACTION' | 'FINISHED';

export type ServerMessage =
  | {
      readonly type: 'welcome';
      readonly roomId: string;
      readonly seat: PlayerId;
      /** 存下来，断线回来时带上它就能坐回原位。 */
      readonly token: string;
      readonly reconnected: boolean;
    }
  /** 还没凑齐两名玩家。 */
  | { readonly type: 'waiting'; readonly roomId: string }
  | { readonly type: 'snapshot'; readonly snapshot: RoomSnapshot }
  | { readonly type: 'presence'; readonly opponentOnline: boolean }
  | { readonly type: 'error'; readonly code: ServerErrorCode; readonly message: string }
  | { readonly type: 'pong' };
