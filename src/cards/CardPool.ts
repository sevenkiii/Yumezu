/**
 * 功能牌池与抽牌。见 RULES.md §13。
 *
 * 没有牌库、弃牌堆与洗牌：每次抽牌都从整个牌池独立等概率抽取（有放回）。
 */

import type { CardId, GameState, HandCard, PlayerId } from '../core/GameState';
import { nextIndex } from '../core/RNG';

/** V1 牌池：11 张，「灵感」不在此列。 */
export const CARD_POOL: readonly CardId[] = [
  'FirstAid',
  'Shield',
  'Assault',
  'Recharge',
  'Purify',
  'Blink',
  'Repulse',
  'BlockRoad',
  'Mark',
  'SealSkill',
  'Trap',
];

export const MAX_HAND_SIZE = 5;
export const INITIAL_HAND_SIZE = 3;

/**
 * 抽一张牌并加入手牌。
 * 会消耗 gameSeed 的 cards 子流，因此只允许在 draft 状态上调用。
 */
export function drawCard(state: GameState, player: PlayerId): HandCard {
  const roll = nextIndex(state.rng.cards, CARD_POOL.length);
  state.rng.cards = roll.next;
  const cardId = CARD_POOL[roll.value] as CardId;
  const owner = state.players[player];
  const card: HandCard = { id: player + '-C' + owner.nextCardSeq, cardId };
  owner.nextCardSeq += 1;
  owner.hand.push(card);
  return card;
}

/** 从手牌中移除一张牌（使用或弃置）。 */
export function removeCardFromHand(
  state: GameState,
  player: PlayerId,
  handCardId: string,
): HandCard | null {
  const hand = state.players[player].hand;
  const index = hand.findIndex((card) => card.id === handCardId);
  if (index < 0) return null;
  const removed = hand[index] as HandCard;
  hand.splice(index, 1);
  return removed;
}
