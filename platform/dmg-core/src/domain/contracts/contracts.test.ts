import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import type { EventOf } from '../events/event-def';
import { allowAll } from '../policy/policy';
import {
  ArchiveDoneErDef,
  CompleteTaskUcDef,
  GetUserUcDef,
  ListTasksUcDef,
  RemindJobDef,
  TaskArDef,
  TaskErrors,
  TaskEvents,
  TaskPolicy,
  TodoModuleDef,
  UsersModuleDef,
} from './contracts.fixture';
import type { ReactionEventOf } from './define-event-reaction';
import { defineEventReaction } from './define-event-reaction';
import { defineJob } from './define-job';
import { defineModule } from './define-module';
import {
  type AnyUseCaseDef,
  defineUseCase,
  type InputOf,
  type OutputOf,
  type UseCaseErrorOf,
} from './define-use-case';

describe('defineUseCase', () => {
  it('Def несёт дискриминатор и ссылки объектами', () => {
    expect(CompleteTaskUcDef.dmg).toBe('useCase');
    expect(CompleteTaskUcDef.aggregate).toBe(TaskArDef);
    expect(CompleteTaskUcDef.policy).toBe(TaskPolicy.rules.canComplete);
    expect(CompleteTaskUcDef.errors).toEqual([
      TaskErrors.NOT_FOUND,
      TaskErrors.ALREADY_DONE,
    ]);
    expect(CompleteTaskUcDef.emits).toEqual([TaskEvents.completed]);
    expect(CompleteTaskUcDef.calls).toEqual([GetUserUcDef]);
  });

  it('calls — только Def UC (MAN-07, D-42)', () => {
    defineUseCase({
      ...ListTasksUcDef,
      // @ts-expect-error в calls — Def UC, а не агрегат или строка
      calls: [TaskArDef],
    });
    const any: AnyUseCaseDef = ListTasksUcDef;
    expect(any.calls).toBeUndefined();
  });

  it('calls — только UC с system в callers (D-43, Р7)', () => {
    const def = defineUseCase({
      ...ListTasksUcDef,
      // @ts-expect-error ListTasks зовёт только user — система его не вызовет
      calls: [GetUserUcDef, ListTasksUcDef],
    });
    expect(def.calls).toHaveLength(2);
  });

  it('input, output и ошибки выводятся из Def', () => {
    const input: InputOf<typeof CompleteTaskUcDef> = { taskId: 'x' };
    const output: OutputOf<typeof CompleteTaskUcDef> = { completedAt: 1 };
    const code: UseCaseErrorOf<typeof CompleteTaskUcDef>['code'] =
      'TASK_NOT_FOUND';
    const core: UseCaseErrorOf<typeof CompleteTaskUcDef> =
      CoreErrors.SERVER_INTERNAL.make();
    // @ts-expect-error чужой код
    const alien: UseCaseErrorOf<typeof CompleteTaskUcDef>['code'] =
      'USER_NOT_FOUND';
    // @ts-expect-error неверный тип входа
    const bad: InputOf<typeof CompleteTaskUcDef> = { taskId: 1 };
    expect([input, output, code, core, alien, bad]).toHaveLength(6);
  });

  it('label, description и policy обязательны, query не публикует события (тип)', () => {
    // @ts-expect-error policy обязательна (без ограничений — allowAll)
    defineUseCase({
      name: 'x',
      label: 'X',
      description: 'X',
      type: 'command',
      aggregate: TaskArDef,
      callers: ['user'],
      input: v.object({}),
      output: v.object({}),
      errors: [],
    });
    // @ts-expect-error нет description
    defineUseCase({
      name: 'x',
      label: 'X',
      type: 'query',
      aggregate: TaskArDef,
      callers: ['user'],
      policy: allowAll,
      input: v.object({}),
      output: v.object({}),
      errors: [],
    });
    // @ts-expect-error query не публикует события
    defineUseCase({
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
    expect(ListTasksUcDef.type).toBe('query');
  });
});

describe('defineEventReaction', () => {
  it('Def несёт on/touches ссылками; calls и emits по умолчанию пусты', () => {
    expect(ArchiveDoneErDef.dmg).toBe('eventReaction');
    expect(ArchiveDoneErDef.on).toEqual([
      TaskEvents.completed,
      TaskEvents.created,
    ]);
    expect(ArchiveDoneErDef.touches).toEqual([TaskArDef]);
    expect(ArchiveDoneErDef.calls).toEqual([]);
    expect(ArchiveDoneErDef.emits).toEqual([]);
  });

  it('calls — Def UC других модулей', () => {
    const er = defineEventReaction({
      name: 'syncUser',
      label: 'Сверить пользователя',
      description: 'Читает пользователя через фасад.',
      on: [TaskEvents.created],
      calls: [GetUserUcDef],
    });
    expect(er.calls).toEqual([GetUserUcDef]);
  });

  it('calls — только UC с system в callers (D-43, Р7)', () => {
    const er = defineEventReaction({
      ...ArchiveDoneErDef,
      // @ts-expect-error ListTasks зовёт только user — система его не вызовет
      calls: [ListTasksUcDef],
    });
    expect(er.calls).toEqual([ListTasksUcDef]);
  });

  it('тип события реакции — union событий из on', () => {
    const e: ReactionEventOf<typeof ArchiveDoneErDef> = TaskEvents.created.make(
      {
        taskId: 't1',
      },
    );
    const name: 'todo.task.completed' | 'todo.task.created' = e.name;
    const completed: EventOf<typeof TaskEvents.completed> = {
      name: 'todo.task.completed',
      payload: { taskId: 't1' },
    };
    const also: ReactionEventOf<typeof ArchiveDoneErDef> = completed;
    expect([name, also.name]).toEqual([
      'todo.task.created',
      'todo.task.completed',
    ]);
  });
});

describe('defineJob', () => {
  it('Def несёт расписание и ссылки', () => {
    expect(RemindJobDef.dmg).toBe('job');
    expect(RemindJobDef.schedule).toEqual({
      kind: 'dailyAt',
      hour: 6,
      minute: 0,
    });
    expect(RemindJobDef.scans).toEqual([TaskArDef]);
    expect(RemindJobDef.calls).toEqual([]);
  });

  it('calls — Def UC других модулей', () => {
    const job = defineJob({ ...RemindJobDef, calls: [GetUserUcDef] });
    expect(job.calls).toEqual([GetUserUcDef]);
  });

  it('calls — только UC с system в callers (D-43, Р7)', () => {
    // @ts-expect-error ListTasks зовёт только user — система его не вызовет
    const job = defineJob({ ...RemindJobDef, calls: [ListTasksUcDef] });
    expect(job.calls).toEqual([ListTasksUcDef]);
  });
});

describe('defineModule', () => {
  it('Def несёт состав и зависимости ссылками', () => {
    expect(TodoModuleDef.dmg).toBe('module');
    expect(TodoModuleDef.dependsOn).toEqual([UsersModuleDef]);
    expect(TodoModuleDef.aggregates).toEqual([TaskArDef]);
    expect(TodoModuleDef.useCases).toEqual([CompleteTaskUcDef, ListTasksUcDef]);
    expect(TodoModuleDef.reactions).toEqual([ArchiveDoneErDef]);
    expect(TodoModuleDef.jobs).toEqual([RemindJobDef]);
    expect('facade' in TodoModuleDef).toBe(false);
  });

  it('внешний модуль объявляет Def UC без реализации (D-37, D-42)', () => {
    const external = defineModule({ ...UsersModuleDef, external: true });
    expect(external.useCases).toEqual([GetUserUcDef]);
  });
});
