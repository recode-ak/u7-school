/** Проверка ввода до построения плана; ошибки — на русском. */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type GenArgs, GenError } from './cli.ts';
import { isKebab, kindNames, type NamedKind } from './naming.ts';

function requireKebab(label: string, value: string | undefined) {
  if (value !== undefined && !isKebab(value)) {
    throw new GenError(
      `${label} «${value}» должно быть в kebab-case (a-z, 0-9, дефисы)`,
    );
  }
}

/** Все файлы под `dir` (рекурсивно), относительные пути. */
function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' });
}

export function validate(args: GenArgs): void {
  requireKebab('Имя модуля', args.module);
  requireKebab('Имя агрегата', args.aggregate);
  requireKebab('Имя', args.name);

  const moduleDir = join(args.domainRoot, args.module);
  const moduleExists = existsSync(join(moduleDir, `${args.module}.module.ts`));

  if (args.kind === 'module') {
    // adopt: legacy-каталог есть, паспорта ещё нет.
    if (args.adopt ? moduleExists : existsSync(moduleDir)) {
      throw new GenError(
        `Модуль «${args.module}» уже существует: ${moduleDir}`,
      );
    }
    return;
  }

  if (!moduleExists) {
    throw new GenError(
      `Модуль «${args.module}» не найден в ${args.domainRoot} ` +
        `(сначала: gen module ${args.module})`,
    );
  }

  const { aggregate } = args;
  if (aggregate !== undefined) {
    const aggDir = join(moduleDir, aggregate);
    if (args.kind === 'aggregate') {
      const taken = args.adopt
        ? existsSync(join(aggDir, `${aggregate}.state.ts`))
        : existsSync(aggDir);
      if (taken) {
        throw new GenError(
          `Агрегат «${args.module}.${aggregate}» уже существует: ${aggDir}`,
        );
      }
      return;
    }
    if (!existsSync(aggDir)) {
      throw new GenError(
        `Агрегат «${args.module}.${aggregate}» не найден ` +
          `(сначала: gen aggregate ${args.module}.${aggregate})`,
      );
    }
  }

  if (args.name !== undefined) {
    const { fileName } = kindNames(args.kind as NamedKind, args.name);
    const taken = listFiles(moduleDir).find(
      (file) => file === fileName || file.endsWith(`/${fileName}`),
    );
    if (taken) {
      throw new GenError(
        `Имя «${args.name}» уже занято в модуле «${args.module}»: ` +
          join(moduleDir, taken),
      );
    }
  }
}
