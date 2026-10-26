import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { TaskEvents } from './task.events';

const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const ASSIGNEE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('TaskEvents — имена', () => {
  it('FQN <модуль>.<агрегат>.<событие>', () => {
    expect(Object.values(TaskEvents).map((e) => e.name)).toEqual([
      'todo.task.created',
      'todo.task.completed',
      'todo.task.archived',
      'todo.task.assigned',
      'todo.task.unassigned',
    ]);
  });
});

describe('TaskEvents.created', () => {
  const { payload } = TaskEvents.created;
  const created = { taskId: TASK, ownerId: OWNER, title: 'Купить хлеб' };

  it('payload с названием — допустим', () => {
    expect(v.parse(payload, created)).toEqual(created);
  });

  it('без названия или с невалидным uuid — недопустим', () => {
    expect(v.is(payload, { taskId: TASK, ownerId: OWNER })).toBe(false);
    expect(v.is(payload, { ...created, ownerId: 'x' })).toBe(false);
  });
});

describe('TaskEvents.assigned / unassigned — событие без смены статуса', () => {
  const assignment = { taskId: TASK, ownerId: OWNER, assigneeId: ASSIGNEE };

  it.each(['assigned', 'unassigned'] as const)(
    '%s: payload с исполнителем — допустим',
    (name) => {
      expect(v.parse(TaskEvents[name].payload, assignment)).toEqual(assignment);
    },
  );

  it.each(['assigned', 'unassigned'] as const)(
    '%s: без исполнителя — недопустим',
    (name) => {
      expect(
        v.is(TaskEvents[name].payload, { taskId: TASK, ownerId: OWNER }),
      ).toBe(false);
    },
  );
});
