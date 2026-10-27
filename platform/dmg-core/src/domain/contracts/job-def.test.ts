import { describe, expect, expectTypeOf, it } from 'bun:test';
import {
  GetUserUcDef,
  ListTasksUcDef,
  TaskArDef,
  TaskEvents,
  UserArDef,
} from './contracts.fixture';
import { type AnyJobDef, JobDef } from './job-def';
import { OperationDef } from './operation-def';

const texts = {
  label: 'Напоминание',
  description: 'Ежедневно напоминает о задачах.',
};

const Remind = JobDef.define({
  name: 'remind',
  ...texts,
  schedule: { kind: 'dailyAt', hour: 6, minute: 0 },
  scans: [TaskArDef, UserArDef],
});

const Sync = JobDef.define({
  name: 'sync',
  ...texts,
  schedule: { kind: 'interval', intervalMs: 60_000 },
  calls: [GetUserUcDef],
  emits: [TaskEvents.created],
});

describe('JobDef', () => {
  it('операция вида job: сокращение Job, файлы в job/', () => {
    expect(Remind).toBeInstanceOf(JobDef);
    expect(Remind).toBeInstanceOf(OperationDef);
    expect(Remind.dmg).toBe('job');
    expect(Remind.abbr).toBe('Job');
    expect(Remind.fileKind).toBe('job');
    expect(Remind.title({ name: 'todo' })).toBe('Job todo.remind');
  });

  it('расписание и ссылки; необъявленные scans, calls, emits — пусто', () => {
    expect(Remind.schedule).toEqual({ kind: 'dailyAt', hour: 6, minute: 0 });
    expect(Remind.scans).toEqual([TaskArDef, UserArDef]);
    expect(Remind.calls).toEqual([]);
    expect(Remind.emits).toEqual([]);
    expect(Sync.scans).toEqual([]);
    expectTypeOf(Remind.calls).toEqualTypeOf<readonly []>();
    expectTypeOf<(typeof Sync)['calls'][number]>().toEqualTypeOf<
      typeof GetUserUcDef
    >();
  });

  it('calls — только UC с system в callers (D-43)', () => {
    const job = JobDef.define({
      name: 'x',
      ...texts,
      schedule: { kind: 'dailyAt', hour: 1, minute: 0 },
      // @ts-expect-error ListTasks зовёт только user — система его не вызовет
      calls: [ListTasksUcDef],
    });
    expect(job.calls).toEqual([ListTasksUcDef]);
  });

  it('aggregates() — scans; mainAggregate() — первый; ни ошибок, ни подписок', () => {
    expect(Remind.aggregates()).toEqual([TaskArDef, UserArDef]);
    expect(Remind.mainAggregate()).toBe(TaskArDef);
    expect(Sync.mainAggregate()).toBeUndefined();
    expect(Remind.referencedErrors()).toEqual([]);
    expect(Remind.subscribedEvents()).toEqual([]);
  });

  it('describe() — тексты без схем', () => {
    expect(Remind.describe()).toEqual({ ...texts, schemas: [] });
  });

  it('normalize() — расписание как есть, ссылки → имена', () => {
    expect(Sync.normalize()).toEqual({
      dmg: 'job',
      name: 'sync',
      ...texts,
      schedule: { kind: 'interval', intervalMs: 60_000 },
      scans: [],
      calls: ['getUser'],
      emits: ['todo.task.created'],
    });
  });

  it('конкретный Def совместим с AnyJobDef; сравнение по ссылке', () => {
    const all: readonly AnyJobDef[] = [Remind, Sync];
    expect(all.includes(Sync)).toBe(true);
  });

  it('структурная типизация: нет private/#', () => {
    type PublicShape = { [K in keyof JobDef]: JobDef[K] };
    expectTypeOf<PublicShape>().toExtend<JobDef>();
  });
});
