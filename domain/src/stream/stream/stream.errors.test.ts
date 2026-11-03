import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StreamErrors } from './stream.errors';

const STREAM = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';

const valid = (schema: v.GenericSchema | undefined, payload: unknown) =>
  schema !== undefined && v.safeParse(schema, payload).success;

describe('StreamErrors — коды и kind (ERR-04)', () => {
  it('шесть ошибок группы STREAM', () => {
    expect(
      Object.values(StreamErrors)
        .map((e): string[] => [e.code, e.kind])
        .sort(),
    ).toEqual(
      [
        ['STREAM_NOT_FOUND', 'not_found'],
        ['STREAM_NOT_ENROLLING', 'conflict'],
        ['STREAM_NOT_ACTIVE', 'conflict'],
        ['STREAM_NOT_COMPLETED', 'conflict'],
        ['STREAM_ALREADY_ARCHIVED', 'conflict'],
        ['STREAM_STUDENTS_IN_PROGRESS', 'conflict'],
      ].sort(),
    );
  });
});

describe('StreamErrors — тексты, видимые пользователю (дословно, v0.2.6)', () => {
  it('поток не найден', () => {
    expect(StreamErrors.NOT_FOUND.label).toBe('Поток не найден');
  });

  it('архив: уже в архиве и не завершён', () => {
    expect(StreamErrors.ALREADY_ARCHIVED.label).toBe(
      'Поток уже находится в архиве.',
    );
    expect(StreamErrors.NOT_COMPLETED.label).toBe(
      'В архив можно отправить только завершённый поток.',
    );
  });

  // Legacy-текст содержит число студентов («N студентов ещё учатся»);
  // статичный label его не передаёт — вопрос orchestrator'у (отчёт).
  it('студенты ещё учатся: начало и конец legacy-текста', () => {
    const { label } = StreamErrors.STUDENTS_IN_PROGRESS;
    expect(label).toStartWith('Нельзя завершить поток');
    expect(label).toEndWith('Сначала укажите исход для каждого.');
  });
});

describe('StreamErrors — схемы payload', () => {
  it('NOT_FOUND: streamId', () => {
    const { payload } = StreamErrors.NOT_FOUND;
    expect(valid(payload, { streamId: STREAM })).toBe(true);
    expect(valid(payload, { streamId: 'x' })).toBe(false);
    expect(valid(payload, {})).toBe(false);
  });

  it('STUDENTS_IN_PROGRESS: список { userId, status }', () => {
    const { payload } = StreamErrors.STUDENTS_IN_PROGRESS;
    expect(
      valid(payload, { pending: [{ userId: USER, status: 'active' }] }),
    ).toBe(true);
    expect(
      valid(payload, { pending: [{ userId: USER, status: 'enrolled' }] }),
    ).toBe(true);
    expect(
      valid(payload, { pending: [{ userId: 'x', status: 'active' }] }),
    ).toBe(false);
    expect(valid(payload, {})).toBe(false);
  });
});
