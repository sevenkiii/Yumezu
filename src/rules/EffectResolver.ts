/**
 * Effect Queue：按顺序结算效果，允许效果再产生效果。见 RULES.md §9 与设计稿的 Effect 系统。
 *
 * 只允许在 draft 状态上调用（会修改传入状态）。
 */

import type { DamageSource, Effect } from '../core/Effect';
import type { GameEvent } from '../core/Event';
import type { CharacterState, GameState, Trap } from '../core/GameState';
import { createStatusSet, findCharacter } from '../core/GameState';
import { TRAP_DAMAGE } from '../cards/definitions/Trap';
import { computeDamage } from './CombatRules';
import { occupantAt } from './Targeting';

/** 结算一批效果，返回产生的事件。 */
export function resolveEffects(state: GameState, effects: readonly Effect[]): GameEvent[] {
  const events: GameEvent[] = [];
  const queue: Effect[] = effects.slice();
  let guard = 0;
  while (queue.length > 0) {
    guard += 1;
    if (guard > 1000) throw new Error('resolveEffects: 效果队列疑似死循环');
    const effect = queue.shift() as Effect;
    applyEffect(state, effect, queue, events);
  }
  return events;
}

function applyEffect(state: GameState, effect: Effect, queue: Effect[], events: GameEvent[]): void {
  switch (effect.kind) {
    case 'DAMAGE':
      applyDamage(state, effect.targetId, effect.amount, effect.source, queue, events);
      return;
    case 'HEAL': {
      const target = livingCharacter(state, effect.targetId);
      if (target === null) return;
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + effect.amount);
      if (target.hp !== before) {
        events.push({
          type: 'HEALED',
          targetId: target.id,
          amount: target.hp - before,
          hpAfter: target.hp,
        });
      }
      return;
    }
    case 'RELOCATE': {
      const target = livingCharacter(state, effect.targetId);
      if (target === null) return;
      if (target.position === effect.to) return;
      const from = target.position;
      target.position = effect.to;
      events.push({
        type: 'MOVED',
        characterId: target.id,
        from,
        to: effect.to,
        cause: effect.cause,
      });
      triggerTraps(state, target, queue, events);
      return;
    }
    case 'SWAP': {
      const a = livingCharacter(state, effect.a);
      const b = livingCharacter(state, effect.b);
      if (a === null || b === null || a.id === b.id) return;
      const positionA = a.position;
      a.position = b.position;
      b.position = positionA;
      events.push({ type: 'SWAPPED', a: a.id, b: b.id });
      triggerTraps(state, a, queue, events);
      triggerTraps(state, b, queue, events);
      return;
    }
    case 'ADD_STATUS': {
      const target = livingCharacter(state, effect.targetId);
      if (target === null || target.statuses[effect.status]) return;
      target.statuses[effect.status] = true;
      events.push({ type: 'STATUS_ADDED', targetId: target.id, status: effect.status });
      return;
    }
    case 'REMOVE_STATUS': {
      const target = livingCharacter(state, effect.targetId);
      if (target === null || !target.statuses[effect.status]) return;
      target.statuses[effect.status] = false;
      events.push({ type: 'STATUS_REMOVED', targetId: target.id, status: effect.status });
      return;
    }
    case 'MODIFY_COOLDOWN': {
      const target = livingCharacter(state, effect.targetId);
      if (target === null) return;
      const from = target.skillCd;
      target.skillCd = Math.max(0, from + effect.delta);
      if (target.skillCd !== from) {
        events.push({ type: 'COOLDOWN_MODIFIED', targetId: target.id, from, to: target.skillCd });
      }
      return;
    }
    case 'BLOCK_EDGE': {
      state.map.blockedEdges.push({
        edge: effect.edge,
        owner: effect.owner,
        expiresAtTurnIndex: state.turnIndex + effect.durationActions + 1,
      });
      events.push({
        type: 'EDGE_BLOCKED',
        edge: effect.edge,
        owner: effect.owner,
        expiresAtTurnIndex: state.turnIndex + effect.durationActions + 1,
      });
      return;
    }
    case 'PLACE_TRAP': {
      state.map.nextTrapSeq += 1;
      state.map.traps.push({
        id: 'T' + state.map.nextTrapSeq,
        owner: effect.owner,
        vertex: effect.vertex,
      });
      events.push({ type: 'TRAP_PLACED', owner: effect.owner, vertex: effect.vertex });
      return;
    }
    case 'SET_SHADOW_MARK': {
      const target = livingCharacter(state, effect.targetId);
      if (target === null) return;
      target.shadowMark = effect.vertex;
      events.push({ type: 'SHADOW_MARK_SET', targetId: target.id, vertex: effect.vertex });
      return;
    }
    default:
      return;
  }
}

function livingCharacter(state: GameState, id: string): CharacterState | null {
  const found = findCharacter(state, id);
  if (found === null || !found.alive) return null;
  return found;
}

function applyDamage(
  state: GameState,
  targetId: string,
  baseAmount: number,
  source: DamageSource,
  queue: Effect[],
  events: GameEvent[],
): void {
  const target = livingCharacter(state, targetId);
  if (target === null) return;

  const plan = computeDamage(state, target, baseAmount, source);

  if (plan.consumedEmpowered && source.sourceCharacterId !== null) {
    const attacker = findCharacter(state, source.sourceCharacterId);
    if (attacker !== null) {
      attacker.statuses.Empowered = false;
      events.push({ type: 'STATUS_REMOVED', targetId: attacker.id, status: 'Empowered' });
    }
  }
  if (plan.consumedMarked) {
    target.statuses.Marked = false;
    events.push({ type: 'STATUS_REMOVED', targetId: target.id, status: 'Marked' });
  }
  if (plan.consumedShielded) {
    target.statuses.Shielded = false;
    events.push({ type: 'STATUS_REMOVED', targetId: target.id, status: 'Shielded' });
  }

  target.hp = Math.max(0, target.hp - plan.amount);
  events.push({
    type: 'DAMAGED',
    targetId: target.id,
    amount: plan.amount,
    hpAfter: target.hp,
    source,
  });

  if (target.hp <= 0) {
    killCharacter(state, target, events);
    return;
  }
  if (plan.triggeredShadow) resolveShadowReturn(state, target, queue, events);
}

/** 影返：伤害结算后立即瞬移回影标记；落点被占据则回返失败。 */
function resolveShadowReturn(
  state: GameState,
  target: CharacterState,
  queue: Effect[],
  events: GameEvent[],
): void {
  const mark = target.shadowMark;
  if (mark === null) return;
  target.shadowMark = null;
  const occupied = occupantAt(state, mark) !== null;
  events.push({ type: 'SHADOW_RETURN', targetId: target.id, vertex: mark, success: !occupied });
  if (occupied) return;
  queue.push({ kind: 'RELOCATE', targetId: target.id, to: mark, cause: 'SHADOW_RETURN' });
}

function killCharacter(state: GameState, character: CharacterState, events: GameEvent[]): void {
  character.hp = 0;
  character.alive = false;
  character.shadowMark = null;
  character.statuses = createStatusSet();
  events.push({ type: 'CHARACTER_DIED', characterId: character.id });
  void state;
}

/** 角色因任何方式进入某节点后，检查该节点上的敌方陷阱。 */
function triggerTraps(
  state: GameState,
  character: CharacterState,
  queue: Effect[],
  events: GameEvent[],
): void {
  const index = state.map.traps.findIndex(
    (trap) => trap.vertex === character.position && trap.owner !== character.owner,
  );
  if (index < 0) return;
  const trap = state.map.traps[index] as Trap;
  state.map.traps.splice(index, 1);
  events.push({
    type: 'TRAP_TRIGGERED',
    owner: trap.owner,
    vertex: trap.vertex,
    targetId: character.id,
  });
  queue.push({
    kind: 'DAMAGE',
    targetId: character.id,
    amount: TRAP_DAMAGE,
    source: { kind: 'TRAP', sourceCharacterId: null, sourcePlayerId: trap.owner },
  });
}
