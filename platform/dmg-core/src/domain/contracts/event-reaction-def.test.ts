import { describe, expect, expectTypeOf, it } from 'bun:test';
import type { EventOf } from '../events/event-def';
import {
  GetUserUcDef,
  ListTasksUcDef,
  TaskArDef,
  TaskEvents,
} from './contracts.fixture';
import {
  type AnyEventReactionDef,
  EventReactionDef,
  type ReactionEventOf,
} from './event-reaction-def';
import { OperationDef } from './operation-def';

const texts = {
  label: 'Архивировать выполненную',
  description: 'Переносит выполненную задачу в архив.',
};

const ArchiveDone = EventReactionDef.define({
  name: 'archiveDone',
  ...texts,
  on: [TaskEvents.completed, TaskEvents.created],
  touches: [TaskArDef],
});

const SyncUser = EventReactionDef.define({
  name: 'syncUser',
  ...texts,
  on: [TaskEvents.created],
  calls: [GetUserUcDef],
  emits: [TaskEvents.completed],
});

describe('EventReactionDef', () => {
  it('операция вида eventReaction: сокращение ER, файлы в er/', () => {
    expect(ArchiveDone).toBeInstanceOf(EventReactionDef);
    expect(ArchiveDone).toBeInstanceOf(OperationDef);
    expect(ArchiveDone.dmg).toBe('eventReaction');
    expect(ArchiveDone.abbr).toBe('ER');
    expect(ArchiveDone.fileKind).toBe('er');
    expect(ArchiveDone.title({ name: 'todo' })).toBe('ER todo.archiveDone');
  });

  it('on, touches — ссылками; необъявленные calls, emits, touches — пусто', () => {
    expect(ArchiveDone.on).toEqual([TaskEvents.completed, TaskEvents.created]);
    expect(ArchiveDone.touches).toEqual([TaskArDef]);
    expect(ArchiveDone.calls).toEqual([]);
    expect(ArchiveDone.emits).toEqual([]);
    expect(SyncUser.touches).toEqual([]);
    expectTypeOf(ArchiveDone.calls).toEqualTypeOf<readonly []>();
  });

  it('calls — те же UC, литеральный тип', () => {
    expect(SyncUser.calls[0]).toBe(GetUserUcDef);
    expectTypeOf<(typeof SyncUser)['calls'][number]>().toEqualTypeOf<
      typeof GetUserUcDef
    >();
  });

  it('calls — только UC с system в callers (D-43)', () => {
    const er = EventReactionDef.define({
      name: 'x',
      ...texts,
      on: [TaskEvents.created],
      // @ts-expect-error ListTasks зовёт только user — система его не вызовет
      calls: [ListTasksUcDef],
    });
    expect(er.calls).toEqual([ListTasksUcDef]);
  });

  it('aggregates() — touches; mainAggregate() — первый', () => {
    expect(ArchiveDone.aggregates()).toEqual([TaskArDef]);
    expect(ArchiveDone.mainAggregate()).toBe(TaskArDef);
    expect(SyncUser.mainAggregate()).toBeUndefined();
  });

  it('subscribedEvents() — события on; ошибок не объявляет', () => {
    expect(ArchiveDone.subscribedEvents()).toEqual([
      TaskEvents.completed,
      TaskEvents.created,
    ]);
    expect(ArchiveDone.referencedErrors()).toEqual([]);
  });

  it('describe() — тексты без схем', () => {
    expect(ArchiveDone.describe()).toEqual({ ...texts, schemas: [] });
  });

  it('normalize() — ссылки → имена', () => {
    expect(SyncUser.normalize()).toEqual({
      dmg: 'eventReaction',
      name: 'syncUser',
      ...texts,
      on: ['todo.task.created'],
      touches: [],
      calls: ['getUser'],
      emits: ['todo.task.completed'],
    });
  });

  it('тип события реакции — union событий из on', () => {
    const completed: EventOf<typeof TaskEvents.completed> = {
      name: 'todo.task.completed',
      payload: { taskId: 't1' },
    };
    const e: ReactionEventOf<typeof ArchiveDone> = completed;
    expectTypeOf<ReactionEventOf<typeof ArchiveDone>['name']>().toEqualTypeOf<
      'todo.task.completed' | 'todo.task.created'
    >();
    // @ts-expect-error SyncUser не подписан на completed
    const bad: ReactionEventOf<typeof SyncUser> = completed;
    expect([e, bad]).toHaveLength(2);
  });

  it('конкретный Def совместим с AnyEventReactionDef; сравнение по ссылке', () => {
    const all: readonly AnyEventReactionDef[] = [ArchiveDone, SyncUser];
    expect(all.includes(SyncUser)).toBe(true);
  });

  it('структурная типизация: нет private/#', () => {
    type PublicShape = { [K in keyof EventReactionDef]: EventReactionDef[K] };
    expectTypeOf<PublicShape>().toExtend<EventReactionDef>();
  });
});
