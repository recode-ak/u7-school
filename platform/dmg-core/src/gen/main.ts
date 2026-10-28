/** Диспетчер `dmg-core gen`: разбор → проверка → план → применение → отчёт. */
import { applyPlan } from './apply';
import { type GenArgs, GenError, type GenKind, parseArgs } from './cli';
import { planDomainAggregate } from './kinds/aggregate';
import { planAppAggregate } from './kinds/app-aggregate';
import { planAppModule } from './kinds/app-module';
import { planDomainModule } from './kinds/module';
import { planModulePackage } from './kinds/module-package';
import { planOperation } from './kinds/operation';
import { planDomainService } from './kinds/service';
import type { GenLayout } from './layout';
import type { GenPlan } from './plan';
import { validate } from './validate';

/** Планировщик по виду артефакта CLI: таблица вместо `switch`. */
const PLANNERS: Record<GenKind, (args: GenArgs) => GenPlan> = {
  module: (args) =>
    merge(planDomainModule(args), planAppModule(args), planModulePackage(args)),
  aggregate: (args) => merge(planDomainAggregate(args), planAppAggregate(args)),
  uc: planOperation,
  er: planOperation,
  job: planOperation,
  dcs: planDomainService,
  dqs: planDomainService,
};

const merge = (...plans: GenPlan[]): GenPlan => ({
  files: plans.flatMap((p) => p.files),
  edits: plans.flatMap((p) => p.edits),
  notes: plans.flatMap((p) => p.notes ?? []),
});

/**
 * Возвращает код выхода процесса; вывод — через `print`. `dependencies` —
 * диапазоны зависимостей пакета модуля (нужны при `gen.package`).
 */
export function runGen(
  argv: readonly string[],
  layout: GenLayout,
  print: (line: string) => void,
  dependencies?: Readonly<Record<string, string>>,
): number {
  try {
    const args = { ...parseArgs(argv, layout), dependencies };
    validate(args);
    const plan = PLANNERS[args.kind](args);
    print(layout.describe());
    const result = applyPlan(plan, { write: args.write, adopt: args.adopt });
    const verb = args.write ? 'Создан' : 'Будет создан';
    for (const path of result.written) print(`${verb}: ${path}`);
    for (const file of result.skipped) {
      print(`Пропущен: ${file.path} (уже есть) — сверь вручную с шаблоном:`);
      for (const line of file.content.trimEnd().split('\n')) print(`  ${line}`);
    }
    for (const path of args.write ? result.edited : editedPaths(plan)) {
      print(`${args.write ? 'Изменён' : 'Будет изменён'}: ${path}`);
    }
    for (const hint of result.hints) {
      print(`Вставь вручную в ${hint.path} перед ${hint.marker}:`);
      print(`  ${hint.line}`);
    }
    for (const note of plan.notes ?? []) print(note);
    if (!args.write) print('Это dry-run. Для записи добавь --write.');
    return 0;
  } catch (error) {
    if (error instanceof GenError) {
      print(`Ошибка: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

const editedPaths = (plan: GenPlan): string[] => [
  ...new Set(plan.edits.map((e) => e.path)),
];
