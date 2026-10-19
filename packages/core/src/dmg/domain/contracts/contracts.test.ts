import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { CoreErrors } from '../../kernel/errors/core-errors';
import type { EventOf } from '../events/define-events';
import {
  ArchiveDoneEr,
  CompleteTaskUc,
  ListTasksUc,
  RemindJob,
  TaskDef,
  TaskErrors,
  TaskEvents,
  TaskPolicy,
  TodoFacade,
  TodoModule,
  UsersModule,
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
    expect(CompleteTaskUc.dmg).toBe('useCase');
    expect(CompleteTaskUc.aggregate).toBe(TaskDef);
    expect(CompleteTaskUc.policy).toBe(TaskPolicy.rules.canComplete);
    expect(CompleteTaskUc.errors).toEqual([
      TaskErrors.NOT_FOUND,
      TaskErrors.ALREADY_DONE,
    ]);
    expect(CompleteTaskUc.emits).toEqual([TaskEvents.completed]);
  });

  it('input, output и ошибки выводятся из Def', () => {
    const input: InputOf<typeof CompleteTaskUc> = { taskId: 'x' };
    const output: OutputOf<typeof CompleteTaskUc> = { completedAt: 1 };
    const code: UseCaseErrorOf<typeof CompleteTaskUc>['code'] =
      'TASK_NOT_FOUND';
    const core: UseCaseErrorOf<typeof CompleteTaskUc> =
      CoreErrors.SERVER_INTERNAL.make();
    // @ts-expect-error чужой код
    const alien: UseCaseErrorOf<typeof CompleteTaskUc>['code'] =
      'USER_NOT_FOUND';
    // @ts-expect-error неверный тип входа
    const bad: InputOf<typeof CompleteTaskUc> = { taskId: 1 };
    expect([input, output, code, core, alien, bad]).toHaveLength(6);
  });

  it('label и description обязательны, query не публикует события (тип)', () => {
    // @ts-expect-error нет description
    defineUseCase({
      name: 'x',
      label: 'X',
      type: 'query',
      aggregate: TaskDef,
      callers: ['user'],
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
      aggregate: TaskDef,
      callers: ['user'],
      input: v.object({}),
      output: v.object({}),
      errors: [],
      emits: [TaskEvents.created],
    });
    expect(ListTasksUc.type).toBe('query');
  });
});

describe('defineEventReaction', () => {
  it('Def несёт on/touches/calls ссылками; emits по умолчанию пуст', () => {
    expect(ArchiveDoneEr.dmg).toBe('eventReaction');
    expect(ArchiveDoneEr.on).toEqual([
      TaskEvents.completed,
      TaskEvents.created,
    ]);
    expect(ArchiveDoneEr.touches).toEqual([TaskDef]);
    expect(ArchiveDoneEr.calls).toEqual([TodoFacade]);
    expect(ArchiveDoneEr.emits).toEqual([]);
  });

  it('тип события реакции — union событий из on', () => {
    const e: ReactionEventOf<typeof ArchiveDoneEr> = TaskEvents.created.make({
      taskId: 't1',
    });
    const name: 'todo.task.completed' | 'todo.task.created' = e.name;
    const completed: EventOf<typeof TaskEvents.completed> = {
      name: 'todo.task.completed',
      payload: { taskId: 't1' },
    };
    const also: ReactionEventOf<typeof ArchiveDoneEr> = completed;
    expect([name, also.name]).toEqual([
      'todo.task.created',
      'todo.task.completed',
    ]);
  });
});

describe('defineJob', () => {
  it('Def несёт расписание и ссылки', () => {
    expect(RemindJob.dmg).toBe('job');
    expect(RemindJob.schedule).toEqual({ kind: 'dailyAt', hour: 6, minute: 0 });
    expect(RemindJob.scans).toEqual([TaskDef]);
  });
});

describe('defineFacade', () => {
  it('методы с label/description и ошибками', () => {
    expect(TodoFacade.dmg).toBe('facade');
    expect(TodoFacade.methods.isDone.dmg).toBe('facadeMethod');
    expect(TodoFacade.methods.isDone.errors).toEqual([TaskErrors.NOT_FOUND]);
  });

  it('тип API фасада выводится из Def', async () => {
    const api: FacadeApi<typeof TodoFacade> = {
      isDone: async () => TaskErrors.NOT_FOUND.err(),
    };
    const res = await api.isDone('t1');
    expect(res.ok ? res.value : res.error.code).toBe('TASK_NOT_FOUND');
    const wrong: FacadeApi<typeof TodoFacade> = {
      // @ts-expect-error ошибка не объявлена в контракте фасада
      isDone: async () => TaskErrors.ALREADY_DONE.err(),
    };
    expect(wrong).toBeDefined();
  });
});

describe('defineModule', () => {
  it('Def несёт состав и зависимости ссылками', () => {
    expect(TodoModule.dmg).toBe('module');
    expect(TodoModule.dependsOn).toEqual([UsersModule]);
    expect(TodoModule.aggregates).toEqual([TaskDef]);
    expect(TodoModule.useCases).toEqual([CompleteTaskUc, ListTasksUc]);
    expect(TodoModule.reactions).toEqual([ArchiveDoneEr]);
    expect(TodoModule.jobs).toEqual([RemindJob]);
    expect(TodoModule.facade).toBe(TodoFacade);
  });
});
