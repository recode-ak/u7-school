import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ApiApp } from '../../../../../api/app/api-app';
import type { AppMeta } from '../../../../../domain/types';
import { InProcEventBus } from '../../../../../infra/in-proc-event-bus';
import type { EventEnvelope } from '../../../../app/events/event-envelope';
import { legacyEventBus } from '../../../../app/events/legacy-event-bus';
import { legacyJob } from '../../../../app/job/legacy-job';
import type { RequestMeta } from '../../../../app/trace';
import type { Caller } from '../../../../kernel/caller/caller';
import { type LogRecord, memoryLogger } from '../../../app-context';
import { expectErr, expectOk } from '../../../expect-result';
import {
  CompleteTaskUcDef,
  CreateTaskUcDef,
  ListTasksUcDef,
  TaskEvents,
} from '../../todo';
import { UserEvents } from '../../users/user/user.ar';
import type { ExampleUser } from '../app-user';
import { TaskJsonRepo } from './infra/task.json-repo';
import { ArchiveDoneTasksJob } from './task/job/archive-done-tasks.job';
import { todoFacade } from './todo.facade';
import { createTodoModule, type TodoDeps } from './todo.module';

const ANNA = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const BORIS = '6f4e2d3c-8b7a-4f9e-8a1b-b2c3d4e5f6a7';

const caller = (uuid: string, admin = false): Caller<ExampleUser> => ({
  kind: 'user',
  user: { uuid, hasRole: () => admin },
});

let dir: string;
let legacy: InProcEventBus;
let deps: TodoDeps;
let api: ApiApp<AppMeta, ExampleUser>;
let logs: LogRecord[];

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'dmg-todo-'));
  legacy = new InProcEventBus();
  logs = [];
  deps = {
    app: {
      bus: legacyEventBus(legacy),
      logger: memoryLogger(logs),
      mode: 'test',
    },
    tasks: new TaskJsonRepo(path.join(dir, 'tasks.json')),
  };
  api = new ApiApp<AppMeta, ExampleUser>([]).addDmgModules(
    createTodoModule(deps),
  );
  api.init({ start: () => {}, stop: () => {} });
});
afterEach(() => rm(dir, { recursive: true, force: true }));

async function create(title: string, owner = ANNA): Promise<string> {
  const res = await api.run(CreateTaskUcDef, { title }, caller(owner), req());
  return expectOk(res).taskId;
}

async function titles(owner = ANNA): Promise<string[]> {
  const res = await api.run(ListTasksUcDef, {}, caller(owner), req());
  return expectOk(res).map((t) => `${t.title}:${t.status}`);
}

/** Мета запроса транспорта: в тестах — новый requestId на вызов. */
const req = (): RequestMeta => ({ requestId: crypto.randomUUID() });

/** Реакции legacy-шина вызывает без ожидания — дать им отработать. */
const settle = () => new Promise((r) => setTimeout(r, 10));

describe('todo: сквозной сценарий через appApi.run', () => {
  test('создать → выполнить → в списке выполнена', async () => {
    const id = await create('Купить хлеб');
    expectOk(
      await api.run(CompleteTaskUcDef, { taskId: id }, caller(ANNA), req()),
    );
    expect(await titles()).toEqual(['Купить хлеб:done']);
  });

  test('список — только задачи вызывающего', async () => {
    await create('Анна', ANNA);
    await create('Борис', BORIS);
    expect(await titles(BORIS)).toEqual(['Борис:open']);
  });

  test('чужую задачу выполнить нельзя, администратору можно', async () => {
    const id = await create('Купить хлеб');
    const foreign = await api.run(
      CompleteTaskUcDef,
      { taskId: id },
      caller(BORIS),
      req(),
    );
    expectErr(foreign, 'ACCESS_DENIED');
    const admin = caller(BORIS, true);
    expectOk(await api.run(CompleteTaskUcDef, { taskId: id }, admin, req()));
  });

  test('событие уходит в общую шину — legacy-подписчик его видит', async () => {
    const seen: string[] = [];
    legacy.subscribe('todo.task.created', async (e) => {
      seen.push(e.eventName);
    });
    await create('Купить хлеб');
    expect(seen).toEqual(['todo.task.created']);
  });
});

describe('todo: событие → ER', () => {
  test('удаление пользователя архивирует его задачи', async () => {
    await create('Анна 1');
    await create('Борис', BORIS);
    const removed: EventEnvelope = {
      ...UserEvents.removed.make({ userId: ANNA }),
      eventId: 'e-removed',
      occurredAt: Date.now(),
      aggregateId: ANNA,
      caller: { kind: 'system', source: 'users' },
      cause: { kind: 'request', requestId: 'r-remove' },
      correlationId: 'r-remove',
    };
    const archived: string[] = [];
    deps.app.bus.subscribe(TaskEvents.archived, async (e) => {
      archived.push(e.correlationId);
    });
    deps.app.bus.publish(removed);
    await settle();
    expect(archived).toEqual(['r-remove']);
    expect([await titles(ANNA), await titles(BORIS)]).toEqual([
      [],
      ['Борис:open'],
    ]);
    expect(logs).toEqual([]);
  });
});

describe('todo: Job на существующем планировщике', () => {
  test('выполненные задачи уходят в архив', async () => {
    const id = await create('Купить хлеб');
    await create('Позвонить');
    expectOk(
      await api.run(CompleteTaskUcDef, { taskId: id }, caller(ANNA), req()),
    );
    await legacyJob(new ArchiveDoneTasksJob(deps)).execute();
    expect(await titles()).toEqual(['Позвонить:open']);
  });
});

describe('todo: фасад', () => {
  test('getTask отдаёт задачу только для чтения', async () => {
    const id = await create('Купить хлеб');
    const task = expectOk(await todoFacade(deps).getTask(id));
    expect([task.uuid, task.isDone()]).toEqual([id, false]);
    // @ts-expect-error: ReadonlyAr — мутирующих методов нет (API-04)
    expect(task.complete).toBeDefined();
  });

  test('нет задачи — TASK_NOT_FOUND', async () => {
    expectErr(await todoFacade(deps).getTask(ANNA), 'TASK_NOT_FOUND');
  });
});
