import { beforeEach, describe, expect, test } from 'bun:test';
import { InProcEventBus } from '../../../infra/in-proc-event-bus';
import { defineModule } from '../../domain/contracts/define-module';
import { ok } from '../../kernel/result/result';
import { testAppContext } from '../../testing/app-context';
import {
  ArchiveDoneTasksJobDef,
  ArchiveRemovedUserTasksErDef,
  CompleteTaskUcDef,
  CreateTaskUcDef,
  TaskErrors,
  TodoFacadeDef,
} from '../../testing/example/todo';
import { UserEvents } from '../../testing/example/users/user/user.ar';
import { T0 } from '../app.fixture';
import type { AppContext } from '../context';
import { legacyEventBus } from '../events/legacy-event-bus';
import { implementFacade } from '../facade/implement-facade';
import { JobFromDef, type JobRun } from '../job/job-from-def';
import { ReactionFromDef } from '../reaction/reaction-from-def';
import { UseCaseFromDef } from '../use-case/use-case-from-def';
import { ModuleFromDef, type ModuleMap } from './module-from-def';

const MiniModuleDef = defineModule({
  name: 'mini',
  label: 'Мини',
  description: 'Модуль для проверки карты Def → класс.',
  dependsOn: [],
  aggregates: [],
  useCases: [CompleteTaskUcDef],
  reactions: [ArchiveRemovedUserTasksErDef],
  jobs: [ArchiveDoneTasksJobDef],
  facade: TodoFacadeDef,
});

type Deps = { readonly app: AppContext; reacted: string[] };
/** Субъект, которого даёт приложение. */
type User = { readonly uuid: string; hasRole(role: 'admin'): boolean };
type Map = ModuleMap<typeof MiniModuleDef, Deps, User>;

class CompleteTask extends UseCaseFromDef<
  typeof CompleteTaskUcDef,
  Deps,
  never
> {
  constructor(deps: Deps) {
    super(CompleteTaskUcDef, deps);
  }
  protected load = async () => TaskErrors.NOT_FOUND.err({ taskId: 'x' });
  protected execute = async () => ok({});
}

class ArchiveRemoved extends ReactionFromDef<
  typeof ArchiveRemovedUserTasksErDef,
  Deps
> {
  constructor(deps: Deps) {
    super(ArchiveRemovedUserTasksErDef, deps);
  }
  protected async react() {
    this.resolve.reacted.push(this.def.name);
    return ok();
  }
}

class ArchiveDone extends JobFromDef<typeof ArchiveDoneTasksJobDef, Deps> {
  constructor(deps: Deps) {
    super(ArchiveDoneTasksJobDef, deps);
  }
  protected run = (job: JobRun) => job.forEach([], async () => ok());
}

const map = {
  useCases: { completeTask: CompleteTask },
  reactions: { archiveRemovedUserTasks: ArchiveRemoved },
  jobs: { archiveDoneTasks: ArchiveDone },
  facade: () =>
    implementFacade(TodoFacadeDef, {
      getTask: async (taskId) => TaskErrors.NOT_FOUND.err({ taskId }),
    }),
} satisfies Map;

let deps: Deps;
let mini: ModuleFromDef<typeof MiniModuleDef, Deps, User>;

beforeEach(() => {
  deps = { app: testAppContext().app, reacted: [] };
  mini = new ModuleFromDef<typeof MiniModuleDef, Deps, User>(
    MiniModuleDef,
    map,
    deps,
  );
});

describe('ModuleFromDef', () => {
  test('реализация UC — по его Def; чужой Def — undefined', () => {
    expect(mini.useCase(CompleteTaskUcDef)?.def).toBe(CompleteTaskUcDef);
    expect(mini.useCase(CreateTaskUcDef)).toBeUndefined();
  });

  test('реакции подписываются на шину рядом с legacy-подписчиками', async () => {
    const legacy = new InProcEventBus();
    const legacySeen: string[] = [];
    legacy.subscribe('users.user.removed', async (e) => {
      legacySeen.push(e.eventName);
    });
    const bus = legacyEventBus(legacy);
    deps = { app: { ...testAppContext().app, bus }, reacted: [] };
    new ModuleFromDef<typeof MiniModuleDef, Deps, User>(
      MiniModuleDef,
      map,
      deps,
    ).subscribe();
    bus.publish({
      ...UserEvents.removed.make({ userId: 'u' }),
      eventId: 'e',
      occurredAt: T0,
      aggregateId: 'u',
      caller: { kind: 'system', source: 'test' },
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'r-1',
    });
    await new Promise((r) => setTimeout(r, 0));
    expect([deps.reacted, legacySeen]).toEqual([
      ['archiveRemovedUserTasks'],
      ['users.user.removed'],
    ]);
  });

  test('задания отдаются в форме legacy для планировщика', () => {
    expect(mini.legacyJobs().map((j) => j.jobName)).toEqual([
      'archiveDoneTasks',
    ]);
  });

  test('фасад собирается из карты', () => {
    expect(mini.facade).toBeDefined();
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

  test('пропуск фасада, объявленного в Def', () => {
    const { useCases, reactions, jobs } = map;
    const noFacade = { useCases, reactions, jobs };
    // @ts-expect-error: TodoFacadeDef объявлен — реализация обязательна
    const missing: Map = noFacade;
    expect(missing).toBeDefined();
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
