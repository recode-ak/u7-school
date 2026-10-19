import { beforeEach, describe, expect, test } from 'bun:test';
import { InProcEventBus } from '../../../infra/in-proc-event-bus';
import { defineModule } from '../../domain/contracts/define-module';
import { ok } from '../../kernel/result/result';
import { testAppContext } from '../../testing/app-context';
import {
  ArchiveDoneTasksJob,
  ArchiveRemovedUserTasksEr,
  CompleteTaskUc,
  CreateTaskUc,
  TaskErrors,
  TodoFacade,
} from '../../testing/example/todo';
import { UserEvents } from '../../testing/example/users/user/user.ar';
import { T0 } from '../app.fixture';
import type { AppContext } from '../context';
import { legacyEventBus } from '../events/legacy-event-bus';
import { implementFacade } from '../facade/implement-facade';
import { JobFromDef } from '../job/job-from-def';
import { ReactionFromDef } from '../reaction/reaction-from-def';
import { UseCaseFromDef } from '../use-case/use-case-from-def';
import { ModuleFromDef, type ModuleMap } from './module-from-def';

const MiniModule = defineModule({
  name: 'mini',
  label: 'Мини',
  description: 'Модуль для проверки карты Def → класс.',
  dependsOn: [],
  aggregates: [],
  useCases: [CompleteTaskUc],
  reactions: [ArchiveRemovedUserTasksEr],
  jobs: [ArchiveDoneTasksJob],
  facade: TodoFacade,
});

type Deps = { readonly app: AppContext; reacted: string[] };

class CompleteTask extends UseCaseFromDef<typeof CompleteTaskUc, Deps, never> {
  constructor(deps: Deps) {
    super(CompleteTaskUc, deps);
  }
  protected load = async () => TaskErrors.NOT_FOUND.err({ taskId: 'x' });
  protected execute = async () => ok({});
}

class ArchiveRemoved extends ReactionFromDef<
  typeof ArchiveRemovedUserTasksEr,
  Deps
> {
  constructor(deps: Deps) {
    super(ArchiveRemovedUserTasksEr, deps);
  }
  protected async react() {
    this.resolve.reacted.push(this.def.name);
    return ok();
  }
}

class ArchiveDone extends JobFromDef<typeof ArchiveDoneTasksJob, Deps> {
  constructor(deps: Deps) {
    super(ArchiveDoneTasksJob, deps);
  }
  protected run = () => this.forEach([], async () => ok());
}

const map = {
  useCases: { completeTask: CompleteTask },
  reactions: { archiveRemovedUserTasks: ArchiveRemoved },
  jobs: { archiveDoneTasks: ArchiveDone },
  facade: () =>
    implementFacade(TodoFacade, {
      getTask: async (taskId) => TaskErrors.NOT_FOUND.err({ taskId }),
    }),
} satisfies ModuleMap<typeof MiniModule, Deps>;

let deps: Deps;
let mini: ModuleFromDef<typeof MiniModule, Deps>;

beforeEach(() => {
  deps = { app: testAppContext().app, reacted: [] };
  mini = new ModuleFromDef(MiniModule, map, deps);
});

describe('ModuleFromDef', () => {
  test('реализация UC — по его Def; чужой Def — undefined', () => {
    expect(mini.useCase(CompleteTaskUc)?.def).toBe(CompleteTaskUc);
    expect(mini.useCase(CreateTaskUc)).toBeUndefined();
  });

  test('реакции подписываются на шину рядом с legacy-подписчиками', async () => {
    const legacy = new InProcEventBus();
    const legacySeen: string[] = [];
    legacy.subscribe('users.user.removed', async (e) => {
      legacySeen.push(e.eventName);
    });
    const bus = legacyEventBus(legacy);
    mini.subscribe(bus);
    bus.publish({
      ...UserEvents.removed.make({ userId: 'u' }),
      eventId: 'e',
      occurredAt: T0,
      aggregateId: 'u',
      caller: { kind: 'system', source: 'test' },
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
    const missing: ModuleMap<typeof MiniModule, Deps> = {
      ...map,
      // @ts-expect-error: нет completeTask
      useCases: {},
    };
    expect(missing).toBeDefined();
  });

  test('класс чужого Def под именем UC', () => {
    const wrong: ModuleMap<typeof MiniModule, Deps> = {
      ...map,
      // @ts-expect-error: ArchiveRemoved реализует ER, а не completeTask
      useCases: { completeTask: ArchiveRemoved },
    };
    expect(wrong).toBeDefined();
  });

  test('пропуск фасада, объявленного в Def', () => {
    const { useCases, reactions, jobs } = map;
    const noFacade = { useCases, reactions, jobs };
    // @ts-expect-error: TodoFacade объявлен — реализация обязательна
    const missing: ModuleMap<typeof MiniModule, Deps> = noFacade;
    expect(missing).toBeDefined();
  });
});
