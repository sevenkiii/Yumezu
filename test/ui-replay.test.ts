/**
 * 对局记录：序列化 / 解析，以及"用记录重放能不能还原出同一局"。
 */

import { describe, expect, it } from 'vitest';

import { parseRecord, serializeRecord, type GameRecord } from '../src/ui/replay';
import { createLocalTransport } from '../src/ui/transport';

type Transport = ReturnType<typeof createLocalTransport>;

function newTransport(): Transport {
  return createLocalTransport({ mapSeed: 'replay-map', gameSeed: 'replay-game' });
}

/** 用"永远选第一个合法行动"的固定策略打几步，方便复现。 */
function playSteps(transport: Transport, steps: number): void {
  for (let index = 0; index < steps; index += 1) {
    const action = transport.getSnapshot().legalActions[0];
    if (action === undefined) return;
    transport.dispatch(action);
  }
}

describe('对局记录', () => {
  it('序列化 / 解析能来回', () => {
    const record: GameRecord = {
      version: 1,
      mapSeed: 'm',
      gameSeed: 'g',
      maxTurns: null,
      actions: [{ type: 'PASS', player: 'P1' }],
    };
    expect(parseRecord(serializeRecord(record))).toEqual(record);
  });

  it('读不出来的文本返回 null（不抛错）', () => {
    expect(parseRecord('')).toBeNull();
    expect(parseRecord('{')).toBeNull();
    expect(parseRecord('{"version":2}')).toBeNull();
    expect(parseRecord('{"version":1,"mapSeed":"m","gameSeed":"g","maxTurns":null}')).toBeNull();
    expect(
      parseRecord('{"version":1,"mapSeed":"m","gameSeed":"g","maxTurns":null,"actions":[1]}'),
    ).toBeNull();
  });

  it('回放同一份记录能还原出完全相同的局面', () => {
    const live = newTransport();
    playSteps(live, 24);
    const recordText = live.getSnapshot().record;
    const expectedHash = live.getSnapshot().stateHash;
    const expected = parseRecord(recordText);
    expect(expected).not.toBeNull();
    const total = expected === null ? 0 : expected.actions.length;
    expect(total).toBeGreaterThan(0);

    const replay = newTransport();
    expect(replay.loadRecord(recordText)).toBe(true);
    expect(replay.getSnapshot().replay).toMatchObject({ step: 0, total });

    let guard = 0;
    while (guard < total + 5) {
      const status = replay.getSnapshot().replay;
      if (status === null || status.step >= status.total) break;
      replay.replayStep();
      guard += 1;
    }

    expect(replay.getSnapshot().replay).toMatchObject({ step: total, total });
    expect(replay.getSnapshot().stateHash).toBe(expectedHash);
  });

  it('回放可以回退，也可以中途停下继续玩', () => {
    const live = newTransport();
    playSteps(live, 10);
    const replay = newTransport();
    expect(replay.loadRecord(live.getSnapshot().record)).toBe(true);

    replay.replayStep();
    replay.replayStep();
    expect(replay.getSnapshot().replay).toMatchObject({ step: 2 });

    replay.replayBack();
    expect(replay.getSnapshot().replay).toMatchObject({ step: 1 });

    replay.stopReplay();
    expect(replay.getSnapshot().replay).toBeNull();
    // 停下之后这一局仍然可以正常操作
    expect(replay.getSnapshot().legalActions.length).toBeGreaterThan(0);
  });

  it('载入不合法记录时什么都不改', () => {
    const transport = newTransport();
    playSteps(transport, 3);
    const before = transport.getSnapshot().stateHash;
    expect(transport.loadRecord('{ 这不是记录 }')).toBe(false);
    expect(transport.getSnapshot().stateHash).toBe(before);
    expect(transport.getSnapshot().replay).toBeNull();
  });
});
