import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { normalize } from '#core/graph/normalize';
import { GetUserUcDef } from '#core/testing/example/users/contract';
import { TaskPolicy } from '../task.policy';
import { TaskRules } from '../task.rules';
import { AssignTaskUcDef } from './assign-task.uc';

const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const ASSIGNEE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('AssignTaskUcDef', () => {
  it('command пользователя: ошибки своей группы и users по ссылке, смена исполнителя — unassigned и assigned', () => {
    expect(normalize(AssignTaskUcDef)).toMatchObject({
      name: 'assignTask',
      type: 'command',
      aggregate: 'task',
      callers: ['user', 'delegate'],
      errors: [
        'TASK_NOT_FOUND',
        'USER_NOT_FOUND',
        'TASK_ASSIGNEE_INACTIVE',
        'TASK_NOT_ASSIGNABLE',
      ],
      emits: ['todo.task.unassigned', 'todo.task.assigned'],
    });
  });

  it('право — canManage, правило — над ответом users, calls — getUser', () => {
    expect(AssignTaskUcDef.policy).toBe(TaskPolicy.rules.canManage);
    expect(AssignTaskUcDef.rules).toEqual([TaskRules.rules.assigneeActive]);
    expect(AssignTaskUcDef.calls).toEqual([GetUserUcDef]);
  });

  it('вход — задача и исполнитель (uuid)', () => {
    const input = { taskId: TASK, assigneeId: ASSIGNEE };
    expect(v.is(AssignTaskUcDef.input, input)).toBe(true);
    expect(v.is(AssignTaskUcDef.input, { ...input, assigneeId: 'x' })).toBe(
      false,
    );
  });
});
