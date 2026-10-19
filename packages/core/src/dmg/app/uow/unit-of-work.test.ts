import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type Caller, systemCaller } from '../../kernel/caller/caller';
import { expectOk, resetNow, setNow } from '../../testing';
import { TaskAr, TaskArDef, TaskEvents } from '../../testing/example/todo';
import { UserArDef } from '../../testing/example/users/user/user.ar';
import type { EventBus } from '../events/event-bus';
import type { EventEnvelope } from '../events/event-envelope';
import type { Repository } from './repository';
import { UnitOfWork } from './unit-of-work';

const AT = Date.UTC(2026, 9, 18, 12, 0);
const A = 'a1b2c3d4-0000-4000-8000-00000000000a';
const B = 'a1b2c3d4-0000-4000-8000-00000000000b';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const CALLER: Caller = systemCaller('test');

type Log = string[];

function recordingBus(published: EventEnvelope[], log: Log): EventBus {
  return {
    publish(envelope) {
      log.push(`publish ${envelope.name}`);
      published.push(envelope);
    },
    subscribe: () => () => {},
  };
}

/** Репозиторий, который пишет в журнал начало и конец сохранения. */
function slowRepo(log: Log, fail = false): Repository<TaskAr> {
  return {
    aggregate: TaskArDef,
    async save(ar) {
      log.push(`save ${ar.uuid}`);
      await Promise.resolve();
      if (fail) throw new Error('диск недоступен');
      log.push(`saved ${ar.uuid}`);
    },
  };
}

function task(uuid: string): TaskAr {
  return expectOk(TaskAr.create({ uuid, ownerId: OWNER, title: 'Задача' }));
}

let log: Log;
let published: EventEnvelope[];
let uow: UnitOfWork;

beforeEach(() => {
  setNow(AT);
  log = [];
  published = [];
  uow = new UnitOfWork({ bus: recordingBus(published, log), caller: CALLER });
});
afterEach(resetNow);

describe('UnitOfWork.commit', () => {
  test('сохраняет последовательно в порядке регистрации, затем публикует', async () => {
    uow.register(task(A), slowRepo(log));
    uow.register(task(B), slowRepo(log));
    await uow.commit();
    expect(log).toEqual([
      `save ${A}`,
      `saved ${A}`,
      `save ${B}`,
      `saved ${B}`,
      'publish todo.task.created',
      'publish todo.task.created',
    ]);
  });

  test('повторная регистрация агрегата — одно сохранение', async () => {
    const a = task(A);
    uow.register(a, slowRepo(log));
    uow.register(a, slowRepo(log));
    await uow.commit();
    expect(log.filter((l) => l.startsWith('saved'))).toEqual([`saved ${A}`]);
  });

  test('событие уходит в конверте с вызывающим и причиной', async () => {
    const caused = new UnitOfWork({
      bus: recordingBus(published, log),
      caller: CALLER,
      causationId: 'e-0',
    });
    caused.register(task(A), slowRepo(log));
    await caused.commit();
    expect(published).toEqual([
      {
        ...TaskEvents.created.make({
          taskId: A,
          ownerId: OWNER,
          title: 'Задача',
        }),
        eventId: expect.any(String),
        occurredAt: AT,
        aggregateId: A,
        caller: CALLER,
        causationId: 'e-0',
      },
    ]);
  });

  test('сбой сохранения — исключение, публикации нет', async () => {
    uow.register(task(A), slowRepo(log, true));
    await expect(uow.commit()).rejects.toThrow('диск недоступен');
    expect(published).toEqual([]);
  });

  test('незаявленное событие при `emits` — исключение до сохранения', async () => {
    const strict = new UnitOfWork({
      bus: recordingBus(published, log),
      caller: CALLER,
      emits: [TaskEvents.completed],
    });
    strict.register(task(A), slowRepo(log));
    await expect(strict.commit()).rejects.toThrow(
      'событие todo.task.created не заявлено в emits',
    );
    expect(log).toEqual([]);
  });

  test('агрегат вне `touches` — исключение при регистрации', () => {
    const narrow = new UnitOfWork({
      bus: recordingBus(published, log),
      caller: CALLER,
      touches: [UserArDef],
    });
    expect(() => narrow.register(task(A), slowRepo(log))).toThrow(
      'агрегат task не заявлен в touches',
    );
  });

  test('без регистраций — ничего не делает', async () => {
    await uow.commit();
    expect(log).toEqual([]);
  });
});
