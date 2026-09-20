import { describe, expect, it } from 'vitest';

import type { DamageSource } from '../src/core/Effect';
import { findCharacter } from '../src/core/GameState';
import { resolveEffects } from '../src/rules/EffectResolver';
import { createBattleState } from './support/fixtures';

const attackFromP1 = (id: string): DamageSource => ({
  kind: 'ATTACK',
  sourceCharacterId: id,
  sourcePlayerId: 'P1',
});

function setup() {
  return createBattleState({
    p1: ['Nana', 'Lily', 'Melty'],
    p2: ['Nana', 'Mikage', 'Melty'],
    positions: {
      'P1:Nana': 0,
      'P1:Lily': 13,
      'P1:Melty': 14,
      'P2:Nana': 1,
      'P2:Mikage': 22,
      'P2:Melty': 23,
    },
    currentPlayer: 'P1',
  });
}

describe('伤害结算管线（RULES.md §9）', () => {
  it('加算先、减算后，最后统一钳位', () => {
    const state = setup();
    const attacker = findCharacter(state, 'P1:Nana');
    const target = findCharacter(state, 'P2:Nana');
    if (attacker === null || target === null) throw new Error('missing');
    attacker.statuses.Empowered = true;
    target.statuses.Marked = true;
    target.statuses.Shielded = true;

    resolveEffects(state, [
      { kind: 'DAMAGE', targetId: target.id, amount: 2, source: attackFromP1(attacker.id) },
    ]);

    expect(target.hp).toBe(8);
    expect(target.statuses.Marked).toBe(false);
    expect(target.statuses.Shielded).toBe(false);
    expect(attacker.statuses.Empowered).toBe(false);
  });

  it('护盾最多把伤害减到 0', () => {
    const state = setup();
    const target = findCharacter(state, 'P2:Nana');
    if (target === null) throw new Error('missing');
    target.statuses.Shielded = true;
    resolveEffects(state, [
      { kind: 'DAMAGE', targetId: target.id, amount: 1, source: attackFromP1('P1:Nana') },
    ]);
    expect(target.hp).toBe(10);
    expect(target.statuses.Shielded).toBe(false);
  });

  it('影返：减伤 1 并瞬移回影标记', () => {
    const state = setup();
    const mikage = findCharacter(state, 'P2:Mikage');
    if (mikage === null) throw new Error('missing');
    mikage.position = 25;
    mikage.shadowMark = 20;

    const events = resolveEffects(state, [
      { kind: 'DAMAGE', targetId: mikage.id, amount: 2, source: attackFromP1('P1:Nana') },
    ]);

    expect(mikage.hp).toBe(11);
    expect(mikage.position).toBe(20);
    expect(mikage.shadowMark).toBeNull();
    expect(events.filter((event) => event.type === 'SHADOW_RETURN')).toHaveLength(1);
  });

  it('影返：落点被占据时回返失败，但仍减伤', () => {
    const state = setup();
    const mikage = findCharacter(state, 'P2:Mikage');
    const ally = findCharacter(state, 'P2:Melty');
    if (mikage === null || ally === null) throw new Error('missing');
    mikage.position = 25;
    mikage.shadowMark = 20;
    ally.position = 20;

    const events = resolveEffects(state, [
      { kind: 'DAMAGE', targetId: mikage.id, amount: 2, source: attackFromP1('P1:Nana') },
    ]);

    expect(mikage.hp).toBe(11);
    expect(mikage.position).toBe(25);
    expect(mikage.shadowMark).toBeNull();
    const returns = events.filter((event) => event.type === 'SHADOW_RETURN');
    expect(returns[0]).toMatchObject({ success: false });
  });

  it('陷阱：敌方进入时受到 2 点伤害并移除陷阱', () => {
    const state = setup();
    const victim = findCharacter(state, 'P1:Nana');
    if (victim === null) throw new Error('missing');
    state.map.traps.push({ id: 'T1', owner: 'P2', vertex: 1 });

    const events = resolveEffects(state, [
      { kind: 'RELOCATE', targetId: victim.id, to: 1, cause: 'MOVE' },
    ]);

    expect(victim.hp).toBe(8);
    expect(state.map.traps).toHaveLength(0);
    expect(events.some((event) => event.type === 'TRAP_TRIGGERED')).toBe(true);
  });

  it('己方踩到自己的陷阱不触发', () => {
    const state = setup();
    const owner = findCharacter(state, 'P2:Nana');
    if (owner === null) throw new Error('missing');
    state.map.traps.push({ id: 'T1', owner: 'P2', vertex: 2 });
    resolveEffects(state, [{ kind: 'RELOCATE', targetId: owner.id, to: 2, cause: 'MOVE' }]);
    expect(owner.hp).toBe(10);
    expect(state.map.traps).toHaveLength(1);
  });

  it('治疗不超过上限', () => {
    const state = setup();
    const ally = findCharacter(state, 'P1:Lily');
    if (ally === null) throw new Error('missing');
    ally.hp = 9;
    resolveEffects(state, [{ kind: 'HEAL', targetId: ally.id, amount: 3 }]);
    expect(ally.hp).toBe(10);
  });

  it('阵亡会清除状态与影标记', () => {
    const state = setup();
    const mikage = findCharacter(state, 'P2:Mikage');
    if (mikage === null) throw new Error('missing');
    mikage.shadowMark = 20;
    mikage.statuses.Marked = true;
    resolveEffects(state, [
      { kind: 'DAMAGE', targetId: mikage.id, amount: 99, source: attackFromP1('P1:Nana') },
    ]);
    expect(mikage.alive).toBe(false);
    expect(mikage.hp).toBe(0);
    expect(mikage.shadowMark).toBeNull();
    expect(mikage.statuses.Marked).toBe(false);
  });
});
