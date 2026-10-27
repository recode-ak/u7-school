import { join } from 'node:path';
import { ApiApp } from '#core/app/api-app/api-app';
import type { ModuleFactory } from '#core/app/api-app/api-app.types';
import { type AppContext, systemClock } from '#core/app/context';
import { InProcEventBus } from '#core/app/events/in-proc-event-bus';
import { InProcInbox } from '#core/app/events/inbox';
import { InProcOutbox } from '#core/app/events/outbox';
import { ConsoleLogger } from '#core/app/logger/console-logger';
import { JsonlOperationLog } from '#core/app/oplog/jsonl-operation-log';
import { TodoModuleDef } from '#core/testing/example/todo/contract';
import { UsersModuleDef } from '#core/testing/example/users/contract';
import type { ExampleUser } from './app-user';
import type { ExampleAppEnv, ExampleAppPorts } from './example-app.types';
import { ExampleCallerResolver } from './example-caller-resolver';
import { createTodoModule, TaskJsonRepo } from './todo/index';
import { createUsersModule, UserMemoryRepo } from './users/index';

/**
 * Учебное приложение — корень сборки (D-50): по окружению строит контекст,
 * репозитории и модули `users` + `todo` (раскладку фасадов делает
 * `ApiApp`), отдаёт клиент `api` и резолвер `callers`. Раннер передаёт
 * окружение, строит `Trace` и вызывает `start()`.
 */
export class ExampleApp {
  readonly api: ApiApp<ExampleUser>;
  readonly callers: ExampleCallerResolver;

  constructor(env: ExampleAppEnv, ports: ExampleAppPorts = {}) {
    const context = ExampleApp.context(env, ports);
    const startedAt = context.clock();
    const userRepo = new UserMemoryRepo(
      env.users.map((uuid) => ({
        uuid,
        status: 'active' as const,
        createdAt: startedAt,
        updatedAt: startedAt,
        version: 0,
      })),
    );
    const taskRepo = new TaskJsonRepo(join(env.dataDir, 'tasks.json'));
    const modules: ModuleFactory<ExampleUser>[] = [
      {
        def: UsersModuleDef,
        create: (deps) => createUsersModule({ ...deps, users: userRepo }),
      },
      {
        def: TodoModuleDef,
        create: (deps) => createTodoModule({ ...deps, tasks: taskRepo }),
      },
    ];
    this.api = new ApiApp(context, modules);
    this.callers = new ExampleCallerResolver(this.api);
  }

  /** Подписывает реакции всех модулей; возвращает остановку. */
  start(): () => void {
    return this.api.subscribe();
  }

  private static context(
    env: ExampleAppEnv,
    ports: ExampleAppPorts,
  ): AppContext {
    const logger = ports.logger ?? new ConsoleLogger();
    const bus = ports.bus ?? new InProcEventBus(logger);
    return {
      bus,
      outbox: new InProcOutbox(bus),
      inbox: new InProcInbox(),
      clock: ports.clock ?? systemClock,
      logger,
      mode: env.mode,
      oplog: new JsonlOperationLog(join(env.dataDir, 'oplog')),
    };
  }
}
