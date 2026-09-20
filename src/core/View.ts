/**
 * 按玩家裁剪的视图。见 RULES.md §14。
 *
 * V1 唯一隐藏的信息是手牌内容；其余（地图、位置、HP、状态、陷阱、封锁边）全部公开。
 * 提供这个接口是为了将来加入更多隐藏信息时不必改动引擎。
 */

import type {
  BlockedEdge,
  CharacterState,
  Deployment,
  GamePhase,
  GameResult,
  GameState,
  Graph,
  HandCard,
  PlayerId,
  SpawnInfo,
  Trap,
} from './GameState';
import { opponentOf } from './GameState';

export interface PlayerView {
  readonly viewer: PlayerId;
  readonly phase: GamePhase;
  readonly turnIndex: number;
  readonly currentPlayer: PlayerId;
  readonly firstPlayer: PlayerId;
  readonly result: GameResult | null;
  readonly graph: Graph;
  readonly blockedEdges: readonly BlockedEdge[];
  readonly traps: readonly Trap[];
  readonly spawn: Record<PlayerId, SpawnInfo>;
  readonly characters: readonly CharacterState[];
  /** 自己的手牌（完整内容）。 */
  readonly hand: readonly HandCard[];
  /** 对手的手牌数量。 */
  readonly opponentHandCount: number;
  readonly ownDeployment: Deployment | null;
  /** 对手的部署：只有双方都提交后才会出现。 */
  readonly opponentDeployment: Deployment | null;
  readonly opponentDeploymentSubmitted: boolean;
}

export function getViewFor(state: GameState, viewer: PlayerId): PlayerView {
  const opponent = opponentOf(viewer);
  const revealed = state.phase !== 'DEPLOY';
  return {
    viewer,
    phase: state.phase,
    turnIndex: state.turnIndex,
    currentPlayer: state.currentPlayer,
    firstPlayer: state.firstPlayer,
    result: state.result,
    graph: state.map.graph,
    blockedEdges: state.map.blockedEdges,
    traps: state.map.traps,
    spawn: state.spawn,
    characters: state.characters,
    hand: state.players[viewer].hand,
    opponentHandCount: state.players[opponent].hand.length,
    ownDeployment: state.deployment[viewer],
    opponentDeployment: revealed ? state.deployment[opponent] : null,
    opponentDeploymentSubmitted: state.deployment[opponent] !== null,
  };
}
