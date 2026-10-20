/** Диспетчер `bun run gen`: разбор → проверка → план → применение → отчёт. */
import { applyPlan } from './apply.ts';
import { type GenArgs, GenError, parseArgs } from './cli.ts';
import { planDomainAggregate } from './kinds/aggregate.ts';
import { planAppAggregate } from './kinds/app-aggregate.ts';
import { planAppModule } from './kinds/app-module.ts';
import { planDomainModule } from './kinds/module.ts';
import { planOperation } from './kinds/operation.ts';
import { planDomainService } from './kinds/service.ts';
import type { GenPlan } from './plan.ts';
import { validate } from './validate.ts';

function buildPlan(args: GenArgs): GenPlan {
  switch (args.kind) {
    case 'module':
      return merge(planDomainModule(args), planAppModule(args));
    case 'aggregate':
      return merge(planDomainAggregate(args), planAppAggregate(args));
    case 'uc':
    case 'er':
    case 'job':
      return planOperation(args);
    case 'dcs':
    case 'dqs':
      return planDomainService(args);
  }
}

const merge = (...plans: GenPlan[]): GenPlan => ({
  files: plans.flatMap((p) => p.files),
  edits: plans.flatMap((p) => p.edits),
});

/** Возвращает код выхода процесса; вывод — через `print`. */
export function runGen(
  argv: readonly string[],
  print: (line: string) => void,
): number {
  try {
    const args = parseArgs(argv);
    validate(args);
    const plan = buildPlan(args);
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

if (import.meta.main) {
  process.exit(runGen(process.argv.slice(2), (line) => console.log(line)));
}
