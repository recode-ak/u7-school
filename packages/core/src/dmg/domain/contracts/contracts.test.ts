import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { CoreErrors } from '../../kernel/errors/core-errors';
import type { EventOf } from '../events/define-events';
import { allowAll } from '../policy/policy';
import {
  ArchiveDoneErDef,
  CompleteTaskUcDef,
  ListTasksUcDef,
  RemindJobDef,
  TaskArDef,
  TaskErrors,
  TaskEvents,
  TaskPolicy,
  TodoFacadeDef,
  TodoModuleDef,
  UsersModuleDef,
} from './contracts.fixture';
import type { ReactionEventOf } from './define-event-reaction';
import type { FacadeApi } from './define-facade';
import {
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
  it('Def несёт on/touches/calls ссылками; emits по умолчанию пуст', () => {
    expect(ArchiveDoneErDef.dmg).toBe('eventReaction');
    expect(ArchiveDoneErDef.on).toEqual([
      TaskEvents.completed,
      TaskEvents.created,
    ]);
    expect(ArchiveDoneErDef.touches).toEqual([TaskArDef]);
    expect(ArchiveDoneErDef.calls).toEqual([TodoFacadeDef]);
    expect(ArchiveDoneErDef.emits).toEqual([]);
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
  });
});

describe('defineFacade', () => {
  it('методы с label/description и ошибками', () => {
    expect(TodoFacadeDef.dmg).toBe('facade');
    expect(TodoFacadeDef.methods.isDone.dmg).toBe('facadeMethod');
    expect(TodoFacadeDef.methods.isDone.errors).toEqual([TaskErrors.NOT_FOUND]);
  });

  it('тип API фасада выводится из Def', async () => {
    const api: FacadeApi<typeof TodoFacadeDef> = {
      isDone: async () => TaskErrors.NOT_FOUND.err(),
    };
    const res = await api.isDone('t1');
    expect(res.ok ? res.value : res.error.code).toBe('TASK_NOT_FOUND');
    const wrong: FacadeApi<typeof TodoFacadeDef> = {
      // @ts-expect-error ошибка не объявлена в контракте фасада
      isDone: async () => TaskErrors.ALREADY_DONE.err(),
    };
    expect(wrong).toBeDefined();
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
    expect(TodoModuleDef.facade).toBe(TodoFacadeDef);
  });
});
