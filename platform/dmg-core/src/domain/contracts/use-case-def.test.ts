import { describe, expect, expectTypeOf, it } from 'bun:test';
import * as v from 'valibot';
import { F } from '#core/kernel/fields/fields';
import { toJsonSchema } from '#core/kernel/schema/json-schema';
import { allowAll } from '../policy/rule';
import {
  GetUserUcDef,
  TaskArDef,
  TaskErrors,
  TaskEvents,
  TaskPolicy,
} from './contracts.fixture';
import { OperationDef } from './operation-def';
import { type AnyUseCaseDef, type InputOf, UseCaseDef } from './use-case-def';

const input = v.object({ taskId: F.uuid('задачи') });
const output = v.object({ completedAt: F.timestamp('выполнения') });

const CompleteTask = UseCaseDef.define({
  name: 'completeTask',
  label: 'Завершить задачу',
  description: 'Отмечает задачу выполненной.',
  type: 'command',
  aggregate: TaskArDef,
  callers: ['user'],
  policy: TaskPolicy.rules.canComplete,
  calls: [GetUserUcDef],
  input,
  output,
  errors: [TaskErrors.NOT_FOUND],
  emits: [TaskEvents.completed],
});

const ListTasks = UseCaseDef.define({
  name: 'listTasks',
  label: 'Список задач',
  description: 'Все задачи пользователя.',
  type: 'query',
  aggregate: TaskArDef,
  callers: ['user', 'system'],
  policy: allowAll,
  input: v.object({}),
  output: v.array(v.object({ taskId: F.uuid('задачи') })),
  errors: [],
});

describe('UseCaseDef', () => {
  it('операция вида useCase: сокращение UC, файлы в uc/', () => {
    expect(CompleteTask).toBeInstanceOf(UseCaseDef);
    expect(CompleteTask).toBeInstanceOf(OperationDef);
    expect(CompleteTask.dmg).toBe('useCase');
    expect(CompleteTask.abbr).toBe('UC');
    expect(CompleteTask.fileKind).toBe('uc');
    expect(CompleteTask.title({ name: 'todo' })).toBe('UC todo.completeTask');
  });

  it('поля спеки — те же ссылки, литеральные типы', () => {
    expect(CompleteTask.aggregate).toBe(TaskArDef);
    expect(CompleteTask.policy).toBe(TaskPolicy.rules.canComplete);
    expect(CompleteTask.input).toBe(input);
    expect(CompleteTask.errors).toEqual([TaskErrors.NOT_FOUND]);
    expect(CompleteTask.emits).toEqual([TaskEvents.completed]);
    expect(CompleteTask.calls[0]).toBe(GetUserUcDef);
    expectTypeOf(CompleteTask.type).toEqualTypeOf<'command'>();
    expectTypeOf(CompleteTask.policy).toEqualTypeOf(
      TaskPolicy.rules.canComplete,
    );
    expectTypeOf<(typeof CompleteTask)['calls'][number]>().toEqualTypeOf<
      typeof GetUserUcDef
    >();
    expectTypeOf<InputOf<typeof CompleteTask>>().toEqualTypeOf<{
      taskId: string;
    }>();
  });

  it('необъявленные rules, calls, emits — пустые кортежи', () => {
    expect(ListTasks.rules).toEqual([]);
    expect(ListTasks.calls).toEqual([]);
    expect(ListTasks.emits).toEqual([]);
    expectTypeOf(ListTasks.calls).toEqualTypeOf<readonly []>();
  });

  it('aggregates(), mainAggregate(), referencedErrors()', () => {
    expect(CompleteTask.aggregates()).toEqual([TaskArDef]);
    expect(CompleteTask.mainAggregate()).toBe(TaskArDef);
    expect(CompleteTask.referencedErrors()).toEqual([TaskErrors.NOT_FOUND]);
  });

  it('describe() — тексты и схемы input/output (MAN-01/02/03)', () => {
    expect(CompleteTask.describe()).toEqual({
      label: 'Завершить задачу',
      description: 'Отмечает задачу выполненной.',
      schemas: [
        ['input', input],
        ['output', output],
      ],
    });
  });

  it('normalize() — ссылки → имена, схемы → JSON Schema', () => {
    expect(CompleteTask.normalize()).toEqual({
      dmg: 'useCase',
      name: 'completeTask',
      label: 'Завершить задачу',
      description: 'Отмечает задачу выполненной.',
      type: 'command',
      aggregate: 'task',
      callers: ['user'],
      policy: TaskPolicy.rules.canComplete.normalize(),
      input: toJsonSchema(input),
      output: toJsonSchema(output),
      errors: ['TASK_NOT_FOUND'],
      rules: [],
      calls: ['getUser'],
      emits: ['todo.task.completed'],
    });
  });

  it('calls — только UC с system в callers (D-43)', () => {
    const def = UseCaseDef.define({
      ...ListTasks,
      name: 'x',
      // @ts-expect-error CompleteTask зовёт только user — система его не вызовет
      calls: [GetUserUcDef, CompleteTask],
    });
    expect(def.calls).toHaveLength(2);
  });

  it('query не публикует события (тип)', () => {
    // @ts-expect-error query не публикует события
    UseCaseDef.define({
      name: 'x',
      label: 'X',
      description: 'X',
      type: 'query',
      aggregate: TaskArDef,
      callers: ['user'],
      policy: allowAll,
      input: v.object({}),
      output: v.object({}),
      errors: [],
      emits: [TaskEvents.created],
    });
  });

  it('конкретный Def совместим с AnyUseCaseDef; сравнение по ссылке', () => {
    const all: readonly AnyUseCaseDef[] = [CompleteTask, ListTasks];
    expect(all.includes(ListTasks)).toBe(true);
    const owner = new Map<AnyUseCaseDef, string>([[CompleteTask, 'todo']]);
    expect(owner.get(CompleteTask)).toBe('todo');
  });

  it('структурная типизация: нет private/#', () => {
    type PublicShape = { [K in keyof UseCaseDef]: UseCaseDef[K] };
    expectTypeOf<PublicShape>().toExtend<UseCaseDef>();
  });
});
