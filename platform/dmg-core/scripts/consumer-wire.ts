/**
 * Подключение модуля `todo` в каркасе проекта-потребителя
 * (`scripts/consumer-e2e.sh`) — то, что автор делает руками после
 * `gen module/aggregate/uc` по подсказкам: UC в контракт (D-45), фабрика в
 * корень сборки, Def в `arch-check.ts`, команда UC в раннере; в monorepo —
 * зависимость корня сборки на пакет модуля. Порядок импортов и формат
 * доводит `bun run format` потребителя.
 *
 *   bun scripts/consumer-wire.ts <корень> single|monorepo
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Profile = 'single' | 'monorepo';

/** Пути и спецификаторы каркаса профиля (как у `ScaffoldLayout`). */
type WireLayout = {
  readonly contract: string;
  readonly uc: string;
  readonly app: string;
  readonly runner: string;
  /** Импорт контракта `todo` из корня сборки и раннера */
  readonly contractFrom: string;
  /** Импорт контракта `todo` из `scripts/arch-check.ts` */
  readonly archContractFrom: string;
  /** Импорт входа прикладного пакета `todo` из корня сборки */
  readonly moduleFrom: string;
};

const LAYOUTS: Record<Profile, WireLayout> = {
  single: {
    contract: 'src/domain/todo/contract.ts',
    uc: 'src/domain/todo/task/uc/complete-task.uc.ts',
    app: 'src/app/app.ts',
    runner: 'src/runner/runner-cli.ts',
    contractFrom: '../domain/todo/contract',
    archContractFrom: '../src/domain/todo/contract',
    moduleFrom: './todo',
  },
  monorepo: {
    contract: 'domain/src/todo/contract.ts',
    uc: 'domain/src/todo/task/uc/complete-task.uc.ts',
    app: 'app/src/app.ts',
    runner: 'runners/cli/src/runner-cli.ts',
    contractFrom: '@acme/domain/todo/contract',
    archContractFrom: '@acme/domain/todo/contract',
    moduleFrom: '@acme/todo',
  },
};

/** Правки файлов проекта: замена ровно одного вхождения. */
class ConsumerWiring {
  constructor(
    private readonly root: string,
    private readonly profile: Profile,
  ) {}

  wire(): void {
    const l = LAYOUTS[this.profile];
    this.patch(
      l.contract,
      '/** Кто: сборка приложения',
      "/** Кто: раннер. Зачем: отметить задачу выполненной. */\nexport { CompleteTaskUcDef } from './task/uc/complete-task.uc';\n/** Кто: сборка приложения",
    );
    // Резолвер каркаса — всегда гость: UC открыт и ему.
    this.patch(l.uc, "callers: ['user'],", "callers: ['guest', 'user'],");
    this.prepend(
      l.app,
      `import { TodoModuleDef } from '${l.contractFrom}';\n` +
        `import { createTodoModule, TaskJsonRepo } from '${l.moduleFrom}';\n`,
    );
    this.patch(
      l.app,
      'const modules: ModuleFactory<AppUser>[] = [];',
      `const modules: ModuleFactory<AppUser>[] = [
      {
        def: TodoModuleDef,
        create: (deps) =>
          createTodoModule({
            ...deps,
            taskRepo: new TaskJsonRepo(join(env.dataDir, 'task.json')),
          }),
      },
    ];`,
    );
    this.prepend(
      'scripts/arch-check.ts',
      `import { TodoModuleDef } from '${l.archContractFrom}';\n`,
    );
    this.patch(
      'scripts/arch-check.ts',
      'modules: [],',
      'modules: [TodoModuleDef],',
    );
    this.prepend(
      l.runner,
      `import { CompleteTaskUcDef, TodoModuleDef } from '${l.contractFrom}';\n`,
    );
    this.patch(
      l.runner,
      "    if (command !== 'whoami') {",
      `    if (command === 'complete-task') {
      const trace = Trace.fromRequest({
        requestId: crypto.randomUUID(),
        channel: { name: 'cli' },
      });
      const caller = await this.app.callers.resolve(undefined, trace);
      const res = await this.app.api.dispatch(
        TodoModuleDef,
        CompleteTaskUcDef.command({}),
        caller,
        trace,
      );
      io.out(JSON.stringify(res));
      return res.ok ? EXIT_OK : 2;
    }
    if (command !== 'whoami') {`,
    );
    if (this.profile === 'monorepo') {
      this.patch(
        'app/package.json',
        '"@acme/domain": "workspace:*"',
        '"@acme/domain": "workspace:*",\n    "@acme/todo": "workspace:*"',
      );
    }
  }

  private prepend(path: string, text: string): void {
    const file = join(this.root, path);
    writeFileSync(file, text + readFileSync(file, 'utf8'));
  }

  private patch(path: string, from: string, to: string): void {
    const file = join(this.root, path);
    const text = readFileSync(file, 'utf8');
    if (text.split(from).length !== 2) {
      throw new Error(`${path}: ожидалось одно вхождение «${from}»`);
    }
    writeFileSync(file, text.replace(from, to));
  }
}

if (import.meta.main) {
  const [root, profile] = process.argv.slice(2);
  if (!root || (profile !== 'single' && profile !== 'monorepo')) {
    console.error(
      'Использование: bun scripts/consumer-wire.ts <корень> single|monorepo',
    );
    process.exit(2);
  }
  new ConsumerWiring(root, profile).wire();
}
