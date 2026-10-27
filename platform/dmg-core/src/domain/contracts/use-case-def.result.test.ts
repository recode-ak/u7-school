// Сериализуемый ответ UC (D-49, transport.md §1): круговой путь через JSON
// восстанавливает тот же `Result`, что вернул UC.
import { describe, expect, expectTypeOf, it } from 'bun:test';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import { err, ok, type Result } from '#core/kernel/result/result';
import type { SerializedResult } from '#core/kernel/result/serialized-result.types';
import { CompleteTaskUcDef, TaskErrors } from './contracts.fixture';
import type { OutputOf, UseCaseErrorOf } from './use-case-def';

type Complete = typeof CompleteTaskUcDef;
type CompleteResult = Result<OutputOf<Complete>, UseCaseErrorOf<Complete>>;

function overJson(value: unknown): SerializedResult {
  return JSON.parse(JSON.stringify(value));
}

describe('UseCaseDef: сериализация ответа', () => {
  it('Ok — { ok, value } как есть', () => {
    const result: CompleteResult = ok({ completedAt: 1_700_000_000_000 });

    expect(CompleteTaskUcDef.serializeResult(result)).toEqual({
      ok: true,
      value: { completedAt: 1_700_000_000_000 },
    });
  });

  it('Err — { ok, error: { code, kind, payload } } без текстов', () => {
    const result: CompleteResult = TaskErrors.ALREADY_DONE.err();

    expect(CompleteTaskUcDef.serializeResult(result)).toEqual({
      ok: false,
      error: {
        code: 'TASK_ALREADY_DONE',
        kind: 'conflict',
        payload: undefined,
      },
    });
  });

  it('круговой путь Ok через JSON', () => {
    const result: CompleteResult = ok({ completedAt: 1_700_000_000_000 });

    const wire = overJson(CompleteTaskUcDef.serializeResult(result));

    expect(CompleteTaskUcDef.restoreResult(wire)).toEqual(result);
  });

  it('круговой путь Err ошибки UC через JSON', () => {
    const result: CompleteResult = TaskErrors.NOT_FOUND.err();

    const wire = overJson(CompleteTaskUcDef.serializeResult(result));

    expect(CompleteTaskUcDef.restoreResult(wire)).toEqual(result);
  });

  it('круговой путь базовой ошибки ядра с payload', () => {
    const result: CompleteResult = CoreErrors.ACCESS_DENIED.err({
      rule: 'isOwner',
      denyMessage: 'Только владелец.',
    });

    const wire = overJson(CompleteTaskUcDef.serializeResult(result));

    expect(CompleteTaskUcDef.restoreResult(wire)).toEqual(result);
  });

  it('код вне контракта UC — SERVER_INTERNAL', () => {
    const wire: SerializedResult = {
      ok: false,
      error: { code: 'ALIEN_CODE', kind: 'conflict', payload: undefined },
    };

    expect(CompleteTaskUcDef.restoreResult(wire)).toEqual(
      CoreErrors.SERVER_INTERNAL.err(),
    );
  });

  it('payload не проходит схему ошибки — SERVER_INTERNAL', () => {
    const wire: SerializedResult = {
      ok: false,
      error: { code: 'ACCESS_DENIED', kind: 'access', payload: { rule: 1 } },
    };

    expect(CompleteTaskUcDef.restoreResult(wire)).toEqual(
      CoreErrors.SERVER_INTERNAL.err(),
    );
  });

  it('восстановленный Result типизирован по Def', () => {
    const restored = CompleteTaskUcDef.restoreResult({ ok: true, value: {} });

    expectTypeOf(restored).toEqualTypeOf<CompleteResult>();
  });
});
