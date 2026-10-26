/** Разбор аргументов `dmg-core gen <kind> <m>[.<agg>] <name> [опции]`. */
import type { GenLayout } from './layout';

export class GenError extends Error {
  override name = 'GenError';
}

export type GenKind =
  | 'module'
  | 'aggregate'
  | 'uc'
  | 'er'
  | 'job'
  | 'dcs'
  | 'dqs';

export interface GenArgs {
  kind: GenKind;
  module: string;
  aggregate?: string;
  name?: string;
  write: boolean;
  /** Режим перевода legacy-модуля: существующие точки входа не перезаписываются. */
  adopt: boolean;
  /** Раскладка проекта (`dmg-core.json`, `gen`) */
  layout: GenLayout;
}

/** Что ожидает вид: цель (`m` или `m.agg`) и нужно ли имя. */
const SHAPE: Record<
  GenKind,
  { target: 'module' | 'aggregate'; name: boolean }
> = {
  module: { target: 'module', name: false },
  aggregate: { target: 'aggregate', name: false },
  uc: { target: 'aggregate', name: true },
  er: { target: 'aggregate', name: true },
  job: { target: 'aggregate', name: true },
  dcs: { target: 'module', name: true },
  dqs: { target: 'module', name: true },
};

const USAGE =
  'Использование: dmg-core gen <вид> <модуль>[.<агрегат>] [<имя>] [--write] ' +
  '[--dry-run] [--adopt]\n' +
  `Виды: ${Object.keys(SHAPE).join(', ')}`;

export function parseArgs(argv: readonly string[], layout: GenLayout): GenArgs {
  const positional: string[] = [];
  let write = false;
  let adopt = false;

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    if (arg === '--write') write = true;
    else if (arg === '--dry-run') write = false;
    else if (arg === '--adopt') adopt = true;
    else throw new GenError(`Неизвестная опция ${arg}\n${USAGE}`);
  }

  const [kind, target, name, ...rest] = positional;
  if (kind === undefined) throw new GenError(USAGE);
  if (!(kind in SHAPE)) {
    throw new GenError(`Неизвестный вид «${kind}»\n${USAGE}`);
  }
  const shape = SHAPE[kind as GenKind];
  if (target === undefined) {
    throw new GenError(
      `Не указан ${shape.target === 'module' ? 'модуль' : 'модуль.агрегат'}\n${USAGE}`,
    );
  }

  const [module = '', aggregate, ...tail] = target.split('.');
  if (shape.target === 'aggregate') {
    if (aggregate === undefined || tail.length > 0) {
      throw new GenError(
        `Для «${kind}» цель задаётся как <модуль>.<агрегат>, получено «${target}»`,
      );
    }
  } else if (aggregate !== undefined) {
    throw new GenError(
      `Для «${kind}» указывается только имя модуля, получено «${target}»`,
    );
  }

  if (shape.name && name === undefined) {
    throw new GenError(`Для «${kind}» нужно имя (kebab-case)\n${USAGE}`);
  }
  const extra = shape.name ? rest : [name, ...rest].filter((x) => x);
  if (extra.length > 0) {
    throw new GenError(`Указан лишний аргумент «${extra[0]}»\n${USAGE}`);
  }

  return {
    kind: kind as GenKind,
    module,
    ...(aggregate !== undefined && { aggregate }),
    ...(shape.name && name !== undefined && { name }),
    write,
    adopt,
    layout,
  };
}
