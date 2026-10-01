/**
 * 行动记录的兜底行：这一手什么事件都没产生时，也要在日志里留下痕迹。
 * （起因：Melty Land 只奶到满血友军时不产生事件，整条记录从日志里消失，
 * 看起来像"技能放不出来"。）
 */

import { describe, expect, it } from 'vitest';

import type { Action } from '../src/core/Action';
import { getViewFor } from '../src/core/View';
import { describeTurn } from '../src/ui/formatEvent';
import { getText } from '../src/ui/i18n';
import { createBattleState } from './support/fixtures';

const text = getText();

function battle() {
  return createBattleState({
    p1: ['Melty', 'Nana'],
    p2: ['Mikage'],
    positions: { 'P1:Melty': 0, 'P1:Nana': 1, 'P2:Mikage': 20 },
    currentPlayer: 'P1',
  });
}

describe('行动记录', () => {
  it('有事件时只写事件行，不重复写行动行', () => {
    const state = battle();
    const lines = describeTurn(
      getViewFor(state, 'P1'),
      {
        action: { type: 'MOVE', player: 'P1', characterId: 'P1:Melty', to: 6 },
        events: [{ type: 'MOVED', characterId: 'P1:Melty', from: 0, to: 6, cause: 'MOVE' }],
      },
      text,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(text.format.moved(text.player.p1 + ' ' + text.character.Melty.name, 6));
  });

  it('用技能时必写一行"谁用了哪个技能"（事件里没有技能名）', () => {
    const state = battle();
    const action: Action = {
      type: 'USE_SKILL',
      player: 'P1',
      characterId: 'P1:Melty',
      choice: { kind: 'NONE' },
    };
    const lines = describeTurn(getViewFor(state, 'P1'), { action, events: [] }, text);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(text.character.Melty.skillName);
  });

  it('技能只奶到满血时，日志里仍然看得到这一手（不会只剩对手抽牌）', () => {
    const state = battle();
    const action: Action = {
      type: 'USE_SKILL',
      player: 'P1',
      characterId: 'P1:Melty',
      choice: { kind: 'NONE' },
    };
    const lines = describeTurn(
      getViewFor(state, 'P1'),
      {
        action,
        events: [
          { type: 'TURN_START', player: 'P2', turnIndex: 1 },
          { type: 'CARD_DRAWN', player: 'P2', cardId: 'FirstAid', handSize: 1 },
        ],
      },
      text,
    );
    expect(lines[0]).toContain(text.character.Melty.skillName);
  });

  it('移动没产生事件时也兜一行（例如原地不动）', () => {
    const state = battle();
    const action: Action = { type: 'MOVE', player: 'P1', characterId: 'P1:Melty', to: 0 };
    const lines = describeTurn(getViewFor(state, 'P1'), { action, events: [] }, text);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(text.character.Melty.name);
  });
});
