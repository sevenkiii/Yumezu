/**
 * 把引擎事件翻译成给玩家看的一行文字。
 * 只做展示：事件本身的语义完全由引擎决定。
 */

import type { Action } from '../core/Action';
import type { GameEvent } from '../core/Event';
import type { CharacterId, PlayerId } from '../core/GameState';
import type { PlayerView } from '../core/View';
import type { UiText } from './i18n';

export function playerLabel(player: PlayerId, t: UiText): string {
  return player === 'P1' ? t.player.p1 : t.player.p2;
}

export function characterLabel(view: PlayerView, id: CharacterId, t: UiText): string {
  const character = view.characters.find((item) => item.id === id);
  if (character === undefined) return id;
  return playerLabel(character.owner, t) + ' ' + t.character[character.typeId].name;
}

function resultText(view: PlayerView, t: UiText): string {
  const result = view.result;
  if (result === null) return '';
  if (result.kind === 'WIN') return t.format.win(playerLabel(result.winner, t));
  return t.format.draw;
}

/** 事件的单行描述；返回 null 表示这条事件不进日志（噪声太大）。 */
export function describeEvent(view: PlayerView, event: GameEvent, t: UiText): string | null {
  switch (event.type) {
    case 'DAMAGED': {
      const source =
        event.source.sourceCharacterId === null
          ? t.card.Trap.name
          : characterLabel(view, event.source.sourceCharacterId, t);
      return t.format.attacked(source, characterLabel(view, event.targetId, t), event.amount);
    }
    case 'HEALED':
      return t.format.healed(characterLabel(view, event.targetId, t), event.amount);
    case 'MOVED':
      return t.format.moved(characterLabel(view, event.characterId, t), event.to);
    case 'SWAPPED':
      return t.format.swapped(characterLabel(view, event.a, t), characterLabel(view, event.b, t));
    case 'STATUS_ADDED':
      return t.format.statusAdded(
        characterLabel(view, event.targetId, t),
        t.status[event.status].name,
      );
    case 'STATUS_REMOVED':
      return t.format.statusRemoved(
        characterLabel(view, event.targetId, t),
        t.status[event.status].name,
      );
    case 'COOLDOWN_MODIFIED':
      return t.format.cooldownModified(characterLabel(view, event.targetId, t), event.to);
    case 'CARD_PLAYED':
      return t.format.cardPlayed(t.card[event.cardId].name, playerLabel(event.player, t));
    case 'CARD_DRAWN':
      return t.format.cardDrawn(1, playerLabel(event.player, t));
    case 'CARD_DISCARDED':
      return t.format.cardDiscarded(t.card[event.cardId].name, playerLabel(event.player, t));
    case 'EDGE_BLOCKED':
      return t.format.edgeBlocked(event.edge);
    case 'EDGE_UNBLOCKED':
      return t.format.edgeUnblocked(event.edge);
    case 'TRAP_PLACED':
      return t.format.trapPlaced(event.vertex);
    case 'TRAP_TRIGGERED':
      return t.format.trapTriggered(characterLabel(view, event.targetId, t), event.vertex);
    case 'SHADOW_RETURN':
      return t.format.shadowReturn(characterLabel(view, event.targetId, t), event.success);
    case 'CHARACTER_DIED':
      return t.format.died(characterLabel(view, event.characterId, t));
    case 'GAME_END':
      return t.format.gameEnd(resultText(view, t));
    default:
      return null;
  }
}

/** 一个回合的日志行：行动本身 + 它产生的事件。 */
export function describeTurn(
  view: PlayerView,
  turn: { readonly action: Action; readonly events: readonly GameEvent[] },
  t: UiText,
): string[] {
  const lines: string[] = [];
  const action = turn.action;
  if (action.type === 'PASS') lines.push(t.format.pass(playerLabel(action.player, t)));
  if (action.type === 'DEPLOY') lines.push(t.format.deploy(playerLabel(action.player, t)));
  // 技能没有对应事件（事件只记录结果），所以"谁用了哪个技能"必须自己写一行
  if (action.type === 'USE_SKILL') {
    const character = view.characters.find((item) => item.id === action.characterId);
    if (character !== undefined) {
      lines.push(
        t.format.usedSkill(
          characterLabel(view, action.characterId, t),
          t.character[character.typeId].skillName,
        ),
      );
    }
  }
  for (const event of turn.events) {
    const line = describeEvent(view, event, t);
    if (line !== null) lines.push(line);
  }
  // 这一手什么事件都没产生（原地移动、伤害被减到 0…）时兜一行，
  // 否则整条记录只剩下一句"对手抽了 1 张牌"，看起来像"点了没反应"。
  if (lines.length === 0) {
    const fallback = describeAction(view, action, t);
    if (fallback !== null) lines.push(fallback);
  }
  return lines;
}

/** 行动的兜底描述：只在"这一手没有任何可展示内容"时用。 */
function describeAction(view: PlayerView, action: Action, t: UiText): string | null {
  switch (action.type) {
    case 'MOVE':
      return t.format.actedMove(characterLabel(view, action.characterId, t));
    case 'ATTACK':
      return t.format.actedAttack(characterLabel(view, action.characterId, t));
    default:
      return null;
  }
}
