import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { TaskErrors } from './task.errors';

const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const ASSIGNEE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const valid = (schema: v.GenericSchema | undefined, payload: unknown) =>
  schema !== undefined && v.is(schema, payload);

describe('TaskErrors — коды и kind', () => {
  it('код с префиксом TASK_, kind по смыслу', () => {
    expect(Object.values(TaskErrors).map((e) => [e.code, e.kind])).toEqual([
      ['TASK_NOT_FOUND', 'not_found'],
      ['TASK_ALREADY_DONE', 'conflict'],
      ['TASK_ARCHIVED', 'conflict'],
      ['TASK_TOO_MANY_OPEN', 'conflict'],
      ['TASK_NOT_ASSIGNABLE', 'conflict'],
      ['TASK_ASSIGNEE_INACTIVE', 'conflict'],
    ]);
  });
});

describe('TaskErrors — схемы payload', () => {
  it('NOT_FOUND: идентификатор задачи', () => {
    expect(valid(TaskErrors.NOT_FOUND.payload, { taskId: TASK })).toBe(true);
    expect(valid(TaskErrors.NOT_FOUND.payload, { taskId: 'x' })).toBe(false);
  });

  it('TOO_MANY_OPEN: целый предел', () => {
    expect(valid(TaskErrors.TOO_MANY_OPEN.payload, { limit: 3 })).toBe(true);
    expect(valid(TaskErrors.TOO_MANY_OPEN.payload, { limit: 1.5 })).toBe(false);
  });

  it('ASSIGNEE_INACTIVE: исполнитель обязателен', () => {
    const { payload } = TaskErrors.ASSIGNEE_INACTIVE;
    expect(valid(payload, { assigneeId: ASSIGNEE })).toBe(true);
    expect(valid(payload, {})).toBe(false);
  });

  it('отказы переходов — без payload', () => {
    expect(TaskErrors.ALREADY_DONE.payload).toBeUndefined();
    expect(TaskErrors.NOT_ASSIGNABLE.payload).toBeUndefined();
  });

  it('make — код, kind, label, description и payload в значении ошибки', () => {
    expect(TaskErrors.NOT_FOUND.make({ taskId: TASK })).toEqual({
      code: 'TASK_NOT_FOUND',
      kind: 'not_found',
      label: 'Задача не найдена',
      description: TaskErrors.NOT_FOUND.description,
      payload: { taskId: TASK },
    });
  });
});
