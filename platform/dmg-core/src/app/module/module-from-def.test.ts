import { beforeEach, describe, expect, test } from 'bun:test';
import type { Command } from '#core/domain/contracts/command';
import { JobDef } from '#core/domain/contracts/job-def';
import { ModuleDef } from '#core/domain/contracts/module-def';
import { SystemCaller, UserCaller } from '#core/kernel/caller/caller';
import { ok } from '#core/kernel/result/result';
import { Trace } from '#core/kernel/trace/trace';
import { testAppContext } from '#core/testing/app-context';
import {
  ArchiveDoneTasksJobDef,
  CompleteTaskUcDef,
  CreateTaskUcDef,
  ReleaseRemovedUserTasksErDef,
  TaskErrors,
} from '#core/testing/example/todo/index';
import { UserEvents } from '#core/testing/example/users/index';
import { expectErr, expectOk } from '#core/testing/index';
import { MemoryBus } from '#core/testing/memory-bus';
import { T0, TASK } from '../app.fixture';
import type { ModuleDeps } from '../context';
import { ModuleFacades } from '../facade/module-facades';
import { JobFromDef, type JobRun } from '../job/job-from-def';
import { ReactionFromDef } from '../reaction/reaction-from-def';
import { UseCaseFromDef } from '../use-case/use-case-from-def';
import {
  type AnyModuleFromDef,
  ModuleFromDef,
  type ModuleMap,
} from './module-from-def';

const MiniModuleDef = ModuleDef.define({
  name: 'mini',
  label: 'Мини',
  description: 'Модуль для проверки карты Def → класс.',
  dependsOn: [],
  aggregates: [],
  useCases: [CompleteTaskUcDef],
  reactions: [ReleaseRemovedUserTasksErDef],
  jobs: [ArchiveDoneTasksJobDef],
});

/** Модуль без зависимостей — фасадов нет. */
const facades = new ModuleFacades();

type Deps = ModuleDeps & {
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
  constructor(deps: Deps, module: typeof MiniModuleDef) {
    super(CompleteTaskUcDef, deps, module);
  }
  protected async load() {
    return TaskErrors.NOT_FOUND.err({ taskId: 'x' });
  }
  protected async execute() {
    return ok({});
  }
}

class ReleaseRemoved extends ReactionFromDef<
  typeof ReleaseRemovedUserTasksErDef,
  Deps
> {
  constructor(deps: Deps, module: typeof MiniModuleDef) {
    super(ReleaseRemovedUserTasksErDef, deps, module);
  }
  protected async react() {
    this.resolve.reacted.push(this.def.name);
    return ok();
  }
}

class ArchiveDone extends JobFromDef<typeof ArchiveDoneTasksJobDef, Deps> {
  constructor(deps: Deps, module: typeof MiniModuleDef) {
    super(ArchiveDoneTasksJobDef, deps, module);
  }
  protected run(job: JobRun) {
    this.resolve.ran.push(job.trace);
    return job.forEach([], async () => ok());
  }
}

const map = {
  useCases: { completeTask: CompleteTask },
  reactions: { releaseRemovedUserTasks: ReleaseRemoved },
  jobs: { archiveDoneTasks: ArchiveDone },
} satisfies Map;

let deps: Deps;
let mini: ModuleFromDef<typeof MiniModuleDef, Deps, User>;

beforeEach(() => {
  deps = { app: testAppContext().app, facades, reacted: [], ran: [] };
  mini = new ModuleFromDef<typeof MiniModuleDef, Deps, User>(
    MiniModuleDef,
    map,
    deps,
  );
});

const REQ = Trace.fromRequest({ requestId: 'r-1' });
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

  test('операции создаёт модуль и передаёт себя: ref — модуль-владелец (D-43)', () => {
    const seen: unknown[] = [];
    class Spy extends CompleteTask {
      constructor(deps: Deps, module: typeof MiniModuleDef) {
        super(deps, module);
        seen.push(module, this.ref);
      }
    }
    new ModuleFromDef<typeof MiniModuleDef, Deps, User>(
      MiniModuleDef,
      { ...map, useCases: { completeTask: Spy } },
      deps,
    );
    expect(seen).toEqual([
      MiniModuleDef,
      { kind: 'useCase', module: 'mini', name: 'completeTask' },
    ]);
  });

  test('реализации UC наружу не раздаются', () => {
    // @ts-expect-error useCase — не публичный: вход только через handle
    expect(mini.useCase).toBeDefined();
  });
});

describe('ModuleFromDef.dispatch', () => {
  test('команда UC своего модуля — ответ его реализации', async () => {
    const res = await mini.dispatch(
      CompleteTaskUcDef.command({ taskId: TASK }),
      new UserCaller(user),
      REQ,
    );
    expectErr(res, 'TASK_NOT_FOUND');
  });

  test('команда после JSON — UC находится по имени (D-49)', async () => {
    const any: AnyModuleFromDef<User> = mini;
    const wire: Command = JSON.parse(
      JSON.stringify(CompleteTaskUcDef.command({ taskId: TASK })),
    );
    const res = await any.dispatch(wire, new UserCaller(user), REQ);
    expectErr(res, 'TASK_NOT_FOUND');
  });

  test('неизвестный UC — OPERATION_NOT_FOUND с адресом', async () => {
    const any: AnyModuleFromDef<User> = mini;
    const res = await any.dispatch(
      { uc: 'createTask', input: {} },
      new UserCaller(user),
      REQ,
    );
    expect(expectErr(res, 'OPERATION_NOT_FOUND').payload).toEqual({
      module: 'mini',
      uc: 'createTask',
    });
  });

  test('два UC с одним именем в Def модуля — исключение сборки', () => {
    const TwinDef = ModuleDef.define({
      ...MiniModuleDef,
      useCases: [CompleteTaskUcDef, CompleteTaskUcDef],
    });
    // Карту под дубль имени тип не выражает (ключ — имя): проверка рантайма.
    const twinMap = map as never;
    expect(
      () =>
        new ModuleFromDef<typeof TwinDef, Deps, User>(TwinDef, twinMap, deps),
    ).toThrow('Имя UC completeTask повторяется в модуле mini');
  });

  test('команда UC другого модуля — ошибка компиляции', () => {
    const wrong = () =>
      mini.dispatch(
        // @ts-expect-error createTask не из модуля mini
        CreateTaskUcDef.command({ title: 'x' }),
        new UserCaller(user),
        REQ,
      );
    expect(wrong).toBeDefined();
  });
});

describe('ModuleFromDef.runJob', () => {
  test('прогон Job своего модуля со следом вызывающего', async () => {
    const trace = Trace.forJob(ArchiveDoneTasksJobDef);
    expect(expectOk(await mini.runJob(ArchiveDoneTasksJobDef, trace))).toEqual({
      processed: 0,
      failed: 0,
    });
    expect(deps.ran).toEqual([trace]);
  });

  test('Job другого модуля — исключение сборки', async () => {
    const any: AnyModuleFromDef<User> = mini;
    const OtherJobDef = JobDef.define({
      ...ArchiveDoneTasksJobDef,
      name: 'other',
    });
    await expect(
      any.runJob(OtherJobDef, Trace.forJob(OtherJobDef)),
    ).rejects.toThrow('Job other не реализован в модуле mini');
    expect(deps.ran).toEqual([]);
  });
});

describe('ModuleFromDef.subscribe', () => {
  test('реакции подписываются на шину приложения; отписка снимает их', async () => {
    const bus = new MemoryBus();
    deps = {
      app: { ...testAppContext().app, bus },
      facades,
      reacted: [],
      ran: [],
    };
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
    expect(deps.reacted).toEqual(['releaseRemovedUserTasks']);
    off();
    bus.publish(removed);
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.reacted).toEqual(['releaseRemovedUserTasks']);
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
      // @ts-expect-error: ReleaseRemoved реализует ER, а не completeTask
      useCases: { completeTask: ReleaseRemoved },
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
