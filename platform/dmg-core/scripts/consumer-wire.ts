/**
 * Правки проекта-потребителя (`scripts/consumer-e2e.sh`), которые автор
 * делает руками после `gen module/aggregate/uc`: UC в контракт (D-45),
 * `callers` UC под гостя и команда UC в раннере. Модуль к корню сборки,
 * `arch-check.ts` и `package.json` пакета корня подключает сам `gen`.
 * Порядок импортов и формат доводит `bun run format` потребителя.
 *
 *   bun scripts/consumer-wire.ts <корень> single|monorepo [<scope>]
 *
 * scope пакетов monorepo — как его выводит каркас из имени проекта
 * (`@acme/school` → `acme`); по умолчанию `acme`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Profile = 'single' | 'monorepo';

/** Пути и спецификаторы каркаса профиля (как у `ScaffoldLayout`). */
type WireLayout = {
  readonly contract: string;
  readonly uc: string;
  readonly runner: string;
  /** Импорт контракта `todo` из раннера */
  readonly contractFrom: string;
};

const layouts = (scope: string): Record<Profile, WireLayout> => ({
  single: {
    contract: 'src/domain/todo/contract.ts',
    uc: 'src/domain/todo/task/uc/create-task.uc.ts',
    runner: 'src/runner/runner-cli.ts',
    contractFrom: '../domain/todo/contract',
  },
  monorepo: {
    contract: 'domain/src/todo/contract.ts',
    uc: 'domain/src/todo/task/uc/create-task.uc.ts',
    runner: 'runners/cli/src/runner-cli.ts',
    contractFrom: `@${scope}/domain/todo/contract`,
  },
});

/** Правки файлов проекта: замена ровно одного вхождения. */
class ConsumerWiring {
  constructor(
    private readonly root: string,
    private readonly profile: Profile,
    private readonly scope: string,
  ) {}

  wire(): void {
    const l = layouts(this.scope)[this.profile];
    this.patch(
      l.contract,
      '/** Кто: сборка приложения',
      "/** Кто: раннер. Зачем: создать задачу. */\nexport { CreateTaskUcDef } from './task/uc/create-task.uc';\n/** Кто: сборка приложения",
    );
    // Резолвер каркаса — всегда гость: UC открыт и ему.
    this.patch(l.uc, "callers: ['user'],", "callers: ['guest', 'user'],");
    this.prepend(
      l.runner,
      `import { CreateTaskUcDef, TodoModuleDef } from '${l.contractFrom}';\n`,
    );
    this.patch(
      l.runner,
      "    if (command !== 'whoami') {",
      `    if (command === 'create-task') {
      const trace = Trace.fromRequest({
        requestId: crypto.randomUUID(),
        channel: { name: 'cli' },
      });
      const caller = await this.app.callers.resolve(undefined, trace);
      const res = await this.app.api.dispatch(
        TodoModuleDef,
        CreateTaskUcDef.command({}),
        caller,
        trace,
      );
      io.out(JSON.stringify(res));
      return res.ok ? EXIT_OK : 2;
    }
    if (command !== 'whoami') {`,
    );
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
  const [root, profile, scope = 'acme'] = process.argv.slice(2);
  if (!root || (profile !== 'single' && profile !== 'monorepo')) {
    console.error(
      'Использование: bun scripts/consumer-wire.ts <корень> single|monorepo [<scope>]',
    );
    process.exit(2);
  }
  new ConsumerWiring(root, profile, scope).wire();
}
