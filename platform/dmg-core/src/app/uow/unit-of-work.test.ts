import { beforeEach, describe, expect, test } from 'bun:test';
import { Trace } from '#core/kernel/trace/trace';
import {
  TaskAr,
  TaskArDef,
  TaskEvents,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import { UserArDef } from '#core/testing/example/users/user/user.ar';
import { expectErr, expectOk } from '#core/testing/index';
import { RecordingBus } from '#core/testing/memory-bus';
import type { EventEnvelope } from '../events/event-envelope';
import { InProcOutbox, type Outbox } from '../events/outbox';
import {
  type Repository,
  type StoredRecord,
  VersionConflict,
  VersionedRepository,
} from './repository';
import { UnitOfWork } from './unit-of-work';

const AT = Date.UTC(2026, 9, 18, 12, 0);
const A = 'a1b2c3d4-0000-4000-8000-00000000000a';
const B = 'a1b2c3d4-0000-4000-8000-00000000000b';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const TRACE = Trace.fromEvent({ eventId: 'e-0', correlationId: 'c-0' });

type Log = string[];

/** Шина, которая ещё и пишет публикации в журнал порядка. */
class LoggingBus extends RecordingBus {
  constructor(
    published: EventEnvelope[],
    private readonly log: Log,
  ) {
    super(published);
  }

  override publish(envelope: EventEnvelope): void {
    this.log.push(`publish ${envelope.name}`);
    super.publish(envelope);
  }
}

/** Репозиторий, который пишет в журнал начало и конец сохранения. */
/** Задачи в `Map`: сверка версии — база `VersionedRepository`. */
class MapRepo extends VersionedRepository<TaskAr> {
  readonly aggregate = TaskArDef;

  constructor(private readonly rows: Map<string, StoredRecord>) {
    super();
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return this.rows.get(uuid);
  }

  protected async write(ar: TaskAr): Promise<void> {
    this.rows.set(ar.uuid, ar.snapshot());
  }
}

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
  return expectOk(TaskAr.create({ uuid, ownerId: OWNER, title: 'Задача' }, AT));
}

let log: Log;
let published: EventEnvelope[];
let uow: UnitOfWork;

beforeEach(() => {
  log = [];
  published = [];
  uow = new UnitOfWork({
    outbox: new InProcOutbox(new LoggingBus(published, log)),
    trace: TRACE,
    clock: () => AT,
  });
});

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

  test('commit возвращает опубликованные события: имя и eventId', async () => {
    uow.register(task(A), slowRepo(log));
    uow.register(task(B), slowRepo(log));
    const events = expectOk(await uow.commit());
    expect(events).toEqual(
      published.map(({ name, eventId }) => ({ name, eventId })),
    );
    expect(events).toHaveLength(2);
    expect(uow.published).toEqual(events);
  });

  test('повторная регистрация агрегата — одно сохранение', async () => {
    const a = task(A);
    uow.register(a, slowRepo(log));
    uow.register(a, slowRepo(log));
    await uow.commit();
    expect(log.filter((l) => l.startsWith('saved'))).toEqual([`saved ${A}`]);
  });

  test('событие уходит в конверте со следом, без вызывающего (D-43, Р7)', async () => {
    uow.register(task(A), slowRepo(log));
    await uow.commit();
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
        cause: { kind: 'event', eventId: 'e-0' },
        correlationId: 'c-0',
      },
    ]);
    // «Кто вызвал» — в записи породившей операции в логе операций (Р6).
    expect(published[0]).not.toHaveProperty('caller');
  });

  test('сбой сохранения — исключение, публикации нет', async () => {
    uow.register(task(A), slowRepo(log, true));
    await expect(uow.commit()).rejects.toThrow('диск недоступен');
    expect(published).toEqual([]);
  });

  test('конфликт версии — VERSION_CONFLICT, публикации нет', async () => {
    const conflicting: Repository<TaskAr> = {
      aggregate: TaskArDef,
      async save(ar) {
        throw new VersionConflict(TaskArDef, ar.uuid);
      },
    };
    uow.register(task(A), conflicting);
    const res = await uow.commit();
    expect(expectErr(res, 'VERSION_CONFLICT').payload).toEqual({
      aggregate: 'task',
      uuid: A,
    });
    expect(published).toEqual([]);
  });

  test('create с занятым uuid — VERSION_CONFLICT, legacy-запись не изменена', async () => {
    const { version: _, ...legacy } = task(A).snapshot();
    const old = { ...legacy, title: 'Старая' };
    const rows = new Map<string, StoredRecord>([[A, old]]);
    const before = structuredClone(rows.get(A));
    const repo = new MapRepo(rows);
    uow.register(task(A), repo);
    const res = await uow.commit();
    expect(expectErr(res, 'VERSION_CONFLICT').payload).toEqual({
      aggregate: 'task',
      uuid: A,
    });
    expect(rows.get(A)).toEqual(before);
    expect(published).toEqual([]);
  });

  test('конфликт на N-м агрегате — события записанных до него публикуются', async () => {
    const conflicting: Repository<TaskAr> = {
      aggregate: TaskArDef,
      async save(ar) {
        throw new VersionConflict(TaskArDef, ar.uuid);
      },
    };
    uow.register(task(A), slowRepo(log));
    uow.register(task(B), conflicting);
    const res = await uow.commit();
    expectErr(res, 'VERSION_CONFLICT');
    expect(published.map((e) => e.aggregateId)).toEqual([A]);
  });

  test('конфликт на N-м агрегате — опубликованное до него видно в published', async () => {
    const conflicting: Repository<TaskAr> = {
      aggregate: TaskArDef,
      async save(ar) {
        throw new VersionConflict(TaskArDef, ar.uuid);
      },
    };
    uow.register(task(A), slowRepo(log));
    uow.register(task(B), conflicting);
    expectErr(await uow.commit(), 'VERSION_CONFLICT');
    expect(uow.published).toEqual(
      published.map(({ name, eventId }) => ({ name, eventId })),
    );
    expect(uow.published).toHaveLength(1);
  });

  test('сбой сохранения N-го агрегата — события записанных публикуются, исключение', async () => {
    uow.register(task(A), slowRepo(log));
    uow.register(task(B), slowRepo(log, true));
    await expect(uow.commit()).rejects.toThrow('диск недоступен');
    expect(published.map((e) => e.aggregateId)).toEqual([A]);
  });

  test('новый агрегат после записи сохраняется повторно без конфликта', async () => {
    const rows = new Map<string, StoredRecord>();
    const repo = new MapRepo(rows);
    const ar = task(A);
    uow.register(ar, repo);
    expectOk(await uow.commit());
    expectOk(ar.complete(AT));
    const next = new UnitOfWork({
      outbox: new InProcOutbox(new LoggingBus(published, log)),
      trace: TRACE,
      clock: () => AT,
    });
    next.register(ar, repo);
    expectOk(await next.commit());
  });

  test('после записи сохранённой версией считается текущая', async () => {
    const ar = TaskAr.restore({ ...task(A).snapshot(), version: 2 });
    expectOk(ar.complete(AT));
    uow.register(ar, slowRepo(log));
    expectOk(await uow.commit());
    expect(ar.storedVersion).toBe(3);
  });

  test('незаявленное событие при `emits` — исключение до сохранения', async () => {
    const strict = new UnitOfWork({
      outbox: new InProcOutbox(new LoggingBus(published, log)),
      trace: TRACE,
      clock: () => AT,
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
      outbox: new InProcOutbox(new LoggingBus(published, log)),
      trace: TRACE,
      clock: () => AT,
      touches: [UserArDef],
    });
    expect(() => narrow.register(task(A), slowRepo(log))).toThrow(
      'агрегат task не заявлен в touches',
    );
  });

  test('с onViolation нарушения сообщаются, работа не прерывается', async () => {
    const violations: string[] = [];
    const lenient = new UnitOfWork({
      outbox: new InProcOutbox(new LoggingBus(published, log)),
      trace: TRACE,
      clock: () => AT,
      emits: [],
      touches: [UserArDef],
      onViolation: (message) => violations.push(message),
    });
    lenient.register(task(A), slowRepo(log));
    await lenient.commit();
    expect(violations).toEqual([
      'UoW: агрегат task не заявлен в touches',
      'UoW: событие todo.task.created не заявлено в emits',
    ]);
    expect(published).toHaveLength(1);
  });

  test('MAN-13: агрегат чужого модуля — исключение при регистрации', () => {
    const own = new UnitOfWork({
      outbox: new InProcOutbox(new LoggingBus(published, log)),
      trace: TRACE,
      clock: () => AT,
      module: { ...TodoModuleDef, aggregates: [UserArDef] },
    });
    expect(() => own.register(task(A), slowRepo(log))).toThrow(
      'UoW: MAN-13: агрегат task не из модуля todo',
    );
  });

  test('MAN-13: агрегат своего модуля — регистрируется', async () => {
    const own = new UnitOfWork({
      outbox: new InProcOutbox(new LoggingBus(published, log)),
      trace: TRACE,
      clock: () => AT,
      module: TodoModuleDef,
    });
    own.register(task(A), slowRepo(log));
    expectOk(await own.commit());
    expect(log).toEqual([
      `save ${A}`,
      `saved ${A}`,
      'publish todo.task.created',
    ]);
  });

  test('MAN-13 с onViolation — сообщается до проверки touches', () => {
    const violations: string[] = [];
    const lenient = new UnitOfWork({
      outbox: new InProcOutbox(new LoggingBus(published, log)),
      trace: TRACE,
      clock: () => AT,
      module: { ...TodoModuleDef, aggregates: [] },
      touches: [UserArDef],
      onViolation: (message) => violations.push(message),
    });
    lenient.register(task(A), slowRepo(log));
    expect(violations).toEqual([
      'UoW: MAN-13: агрегат task не из модуля todo',
      'UoW: агрегат task не заявлен в touches',
    ]);
  });

  test('без регистраций — ничего не делает', async () => {
    await uow.commit();
    expect(log).toEqual([]);
  });
});

describe('UnitOfWork — outbox (D-47)', () => {
  /** Outbox, который пишет в журнал каждую принятую партию. */
  function recordingOutbox(batches: string[][], fail = false): Outbox {
    return {
      async put(envelopes) {
        log.push(`put ${envelopes.length}`);
        if (fail) throw new Error('outbox недоступен');
        batches.push(envelopes.map((e) => e.aggregateId));
      },
    };
  }

  test('конверты записанных агрегатов — одной партией после записи', async () => {
    const batches: string[][] = [];
    const out = new UnitOfWork({
      outbox: recordingOutbox(batches),
      trace: TRACE,
      clock: () => AT,
    });
    out.register(task(A), slowRepo(log));
    out.register(task(B), slowRepo(log));
    const sent = expectOk(await out.commit());
    expect(log).toEqual([
      `save ${A}`,
      `saved ${A}`,
      `save ${B}`,
      `saved ${B}`,
      'put 2',
    ]);
    expect(batches).toEqual([[A, B]]);
    expect(sent).toHaveLength(2);
  });

  test('сбой N-го агрегата — в outbox только записанные до него', async () => {
    const batches: string[][] = [];
    const out = new UnitOfWork({
      outbox: recordingOutbox(batches),
      trace: TRACE,
      clock: () => AT,
    });
    out.register(task(A), slowRepo(log));
    out.register(task(B), slowRepo(log, true));
    await expect(out.commit()).rejects.toThrow('диск недоступен');
    expect(batches).toEqual([[A]]);
  });

  test('ничего не записано — outbox не вызывается', async () => {
    const batches: string[][] = [];
    const out = new UnitOfWork({
      outbox: recordingOutbox(batches),
      trace: TRACE,
      clock: () => AT,
    });
    out.register(task(A), slowRepo(log, true));
    await expect(out.commit()).rejects.toThrow('диск недоступен');
    expect(log).not.toContain('put 0');
    expect(batches).toEqual([]);
  });

  test('сбой outbox — исключение фиксации, опубликованным ничего не считается', async () => {
    const out = new UnitOfWork({
      outbox: recordingOutbox([], true),
      trace: TRACE,
      clock: () => AT,
    });
    out.register(task(A), slowRepo(log));
    await expect(out.commit()).rejects.toThrow('outbox недоступен');
    expect(out.published).toEqual([]);
  });

  test('сбой сохранения, затем сбой outbox — исходное исключение, сбой outbox в cause', async () => {
    const out = new UnitOfWork({
      outbox: recordingOutbox([], true),
      trace: TRACE,
      clock: () => AT,
    });
    out.register(task(A), slowRepo(log));
    out.register(task(B), slowRepo(log, true));
    const error = await out.commit().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('диск недоступен');
    expect((error as Error).cause).toEqual(new Error('outbox недоступен'));
    expect(out.published).toEqual([]);
  });

  test('сбой сохранения с занятым cause, затем сбой outbox — AggregateError из обоих', async () => {
    const out = new UnitOfWork({
      outbox: recordingOutbox([], true),
      trace: TRACE,
      clock: () => AT,
    });
    const disk = new Error('диск недоступен', { cause: 'EIO' });
    out.register(task(A), slowRepo(log));
    out.register(task(B), {
      aggregate: TaskArDef,
      async save() {
        throw disk;
      },
    });
    const error = await out.commit().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).message).toBe(
      'UoW: сбой сохранения (диск недоступен), затем сбой outbox (outbox недоступен)',
    );
    expect((error as AggregateError).errors).toEqual([
      disk,
      new Error('outbox недоступен'),
    ]);
  });
});
