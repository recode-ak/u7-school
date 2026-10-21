import { beforeEach, describe, expect, test } from 'bun:test';
import { defineModule } from '#core/domain/contracts/define-module';
import { SystemCaller, UserCaller } from '#core/kernel/caller/caller';
import { ok } from '#core/kernel/result/result';
import { memoryBus, testAppContext } from '#core/testing/app-context';
import {
  ArchiveDoneTasksJobDef,
  ArchiveRemovedUserTasksErDef,
  CompleteTaskUcDef,
  CreateTaskUcDef,
  TaskErrors,
} from '#core/testing/example/todo/index';
import { UserEvents } from '#core/testing/example/users/index';
import { expectErr, expectOk } from '#core/testing/index';
import { T0, TASK } from '../app.fixture';
import type { AppContext } from '../context';
import { JobFromDef, type JobRun } from '../job/job-from-def';
import { ReactionFromDef } from '../reaction/reaction-from-def';
import { jobTrace, requestTrace, type Trace } from '../trace';
import { UseCaseFromDef } from '../use-case/use-case-from-def';
import {
  type AnyModuleFromDef,
  ModuleFromDef,
  type ModuleMap,
} from './module-from-def';

const MiniModuleDef = defineModule({
  name: 'mini',
  label: 'Мини',
  description: 'Модуль для проверки карты Def → класс.',
  dependsOn: [],
  aggregates: [],
  useCases: [CompleteTaskUcDef],
  reactions: [ArchiveRemovedUserTasksErDef],
  jobs: [ArchiveDoneTasksJobDef],
});

type Deps = {
  readonly app: AppContext;
  reacted: string[];
  /** След каждого прогона Job — то, что передал вызывающий `runJob`. */
  ran: Trace[];
};
/** Субъект, которого даёт приложение. */
type User = { readonly uuid: string; hasRole(role: 'admin'): boolean };
type Map = ModuleMap<typeof MiniModuleDef, Deps, User>;

class CompleteTask extends UseCaseFromDef<
  typeof CompleteTaskUcDef,
  Deps,
  never
> {
  constructor(deps: Deps) {
    super(CompleteTaskUcDef, deps, MiniModuleDef);
  }
  protected load = async () => TaskErrors.NOT_FOUND.err({ taskId: 'x' });
  protected execute = async () => ok({});
}

class ArchiveRemoved extends ReactionFromDef<
  typeof ArchiveRemovedUserTasksErDef,
  Deps
> {
  constructor(deps: Deps) {
    super(ArchiveRemovedUserTasksErDef, deps, MiniModuleDef);
  }
  protected async react() {
    this.resolve.reacted.push(this.def.name);
    return ok();
  }
}

class ArchiveDone extends JobFromDef<typeof ArchiveDoneTasksJobDef, Deps> {
  constructor(deps: Deps) {
    super(ArchiveDoneTasksJobDef, deps, MiniModuleDef);
  }
  protected run = (job: JobRun) => {
    this.resolve.ran.push(job.trace);
    return job.forEach([], async () => ok());
  };
}

const map = {
  useCases: { completeTask: CompleteTask },
  reactions: { archiveRemovedUserTasks: ArchiveRemoved },
  jobs: { archiveDoneTasks: ArchiveDone },
} satisfies Map;

let deps: Deps;
let mini: ModuleFromDef<typeof MiniModuleDef, Deps, User>;

beforeEach(() => {
  deps = { app: testAppContext().app, reacted: [], ran: [] };
  mini = new ModuleFromDef<typeof MiniModuleDef, Deps, User>(
    MiniModuleDef,
    map,
    deps,
  );
});

const REQ = requestTrace({ requestId: 'r-1' });
const user: User = { uuid: 'u-1', hasRole: () => true };

describe('ModuleFromDef.handle', () => {
  test('UC своего модуля — ответ его реализации', async () => {
    const res = await mini.handle(
      CompleteTaskUcDef,
      { taskId: TASK },
      new UserCaller(user),
      REQ,
    );
    expectErr(res, 'TASK_NOT_FOUND');
  });

  test('UC другого модуля — ошибка компиляции', () => {
    const wrong = () =>
      // @ts-expect-error createTask не из модуля mini
      mini.handle(CreateTaskUcDef, {}, new UserCaller(user), REQ);
    expect(wrong).toBeDefined();
  });

  test('чужой Def при стёртом типе модуля — исключение сборки', async () => {
    const any: AnyModuleFromDef<User> = mini;
    await expect(
      any.handle(CreateTaskUcDef, {}, new UserCaller(user), REQ),
    ).rejects.toThrow('UC createTask не реализован в модуле mini');
  });

  test('serves — свой UC да, чужой нет', () => {
    expect(mini.serves(CompleteTaskUcDef)).toBe(true);
    expect(mini.serves(CreateTaskUcDef)).toBe(false);
  });

  test('реализации UC наружу не раздаются', () => {
    // @ts-expect-error useCase — не публичный: вход только через handle
    expect(mini.useCase).toBeDefined();
  });
});

describe('ModuleFromDef.runJob', () => {
  test('прогон Job своего модуля со следом вызывающего', async () => {
    const trace = jobTrace();
    expect(expectOk(await mini.runJob(ArchiveDoneTasksJobDef, trace))).toEqual({
      processed: 0,
      failed: 0,
    });
    expect(deps.ran).toEqual([trace]);
  });

  test('Job другого модуля — исключение сборки', async () => {
    const any: AnyModuleFromDef<User> = mini;
    const OtherJobDef = { ...ArchiveDoneTasksJobDef, name: 'other' };
    await expect(any.runJob(OtherJobDef, jobTrace())).rejects.toThrow(
      'Job other не реализован в модуле mini',
    );
    expect(deps.ran).toEqual([]);
  });
});

describe('ModuleFromDef.subscribe', () => {
  test('реакции подписываются на шину приложения; отписка снимает их', async () => {
    const bus = memoryBus();
    deps = { app: { ...testAppContext().app, bus }, reacted: [], ran: [] };
    const off = new ModuleFromDef<typeof MiniModuleDef, Deps, User>(
      MiniModuleDef,
      map,
      deps,
    ).subscribe();
    const removed = {
      ...UserEvents.removed.make({ userId: 'u' }),
      eventId: 'e',
      occurredAt: T0,
      aggregateId: 'u',
      caller: new SystemCaller({ kind: 'job', module: 'users', name: 'test' }),
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'r-1',
    } as const;
    bus.publish(removed);
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.reacted).toEqual(['archiveRemovedUserTasks']);
    off();
    bus.publish(removed);
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.reacted).toEqual(['archiveRemovedUserTasks']);
  });
});

describe('ModuleMap — полнота проверяется компилятором', () => {
  test('пропуск реализации UC', () => {
    const missing: Map = {
      ...map,
      // @ts-expect-error: нет completeTask
      useCases: {},
    };
    expect(missing).toBeDefined();
  });

  test('класс чужого Def под именем UC', () => {
    const wrong: Map = {
      ...map,
      // @ts-expect-error: ArchiveRemoved реализует ER, а не completeTask
      useCases: { completeTask: ArchiveRemoved },
    };
    expect(wrong).toBeDefined();
  });

  test('фасада в карте нет (D-42)', () => {
    // @ts-expect-error: фасад собирает приложение, а не карта модуля
    const extra: Map = { ...map, facade: () => ({}) };
    expect(extra).toBeDefined();
  });

  test('UC, которому нужен субъект богаче, чем даёт приложение', () => {
    // Приложение даёт только uuid, а Policy completeTask спрашивает роли.
    type Poor = { readonly uuid: string };
    const poor: ModuleMap<typeof MiniModuleDef, Deps, Poor> = {
      ...map,
      // @ts-expect-error: Caller<Poor> не несёт hasRole
      useCases: { completeTask: CompleteTask },
    };
    expect(poor).toBeDefined();
  });
});
