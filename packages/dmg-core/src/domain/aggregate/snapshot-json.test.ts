import { describe, expect, test } from 'bun:test';
import { TaskAr } from '#core/testing/example/todo/index';
import { expectOk } from '#core/testing/index';

const AT = Date.UTC(2026, 9, 18, 12, 0);
const TASK = 'a1b2c3d4-0000-4000-8000-00000000000a';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';

describe('snapshot() — круг через JSON (D-46)', () => {
  test('новый и изменённый агрегат: снапшот без потерь, Timestamp — число', () => {
    const ar = expectOk(
      TaskAr.create({ uuid: TASK, ownerId: OWNER, title: 'Задача' }, AT),
    );
    const created = ar.snapshot();
    expect(JSON.parse(JSON.stringify(created))).toStrictEqual(created);
    expect(created).not.toHaveProperty('completedAt');

    expectOk(ar.complete(AT));
    const done = ar.snapshot();
    expect(JSON.parse(JSON.stringify(done))).toStrictEqual(done);
    expect(typeof done.completedAt).toBe('number');
    expect(typeof done.updatedAt).toBe('number');
  });

  test('восстановленный из JSON агрегат даёт тот же снапшот', () => {
    const ar = expectOk(
      TaskAr.create({ uuid: TASK, ownerId: OWNER, title: 'Задача' }, AT),
    );
    expectOk(ar.complete(AT));
    const restored = TaskAr.restore(JSON.parse(JSON.stringify(ar.snapshot())));
    expect(restored.snapshot()).toStrictEqual(ar.snapshot());
  });
});
