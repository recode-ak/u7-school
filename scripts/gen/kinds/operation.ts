/** `gen uc|er|job <m>.<agg> <name>` — пара контракт ↔ реализация (naming.md §3). */
import { join } from 'node:path';
import type { GenArgs } from '../cli.ts';
import { kindNames, toCamel, toPascal, toUpperSnake } from '../naming.ts';
import type { GenPlan, PlannedFile } from '../plan.ts';

type OpKind = 'uc' | 'er' | 'job';

/** Маркер списка в паспорте и карте модуля. */
const LIST: Record<OpKind, string> = {
  uc: 'useCases',
  er: 'reactions',
  job: 'jobs',
};

interface Ctx {
  m: string;
  a: string;
  name: string;
  kind: OpKind;
  /** `StreamDeps` */
  deps: string;
  /** `Student` */
  agg: string;
  className: string;
  defName: string;
  /** `complete-student.uc` — без `.ts` */
  base: string;
}

function contract(c: Ctx): string {
  const A = c.agg;
  const camel = toCamel(c.name);
  switch (c.kind) {
    case 'uc':
      return `import { allowAll, defineUseCase } from 'dmg-core';
import * as v from 'valibot';
import { ${A}ArDef } from '../${c.a}.ar';
import { ${A}Events } from '../${c.a}.events';

export const ${c.defName} = defineUseCase({
  name: '${camel}',
  label: 'TODO: название операции',
  description: 'TODO: что делает операция',
  type: 'command',
  aggregate: ${A}ArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({}),
  output: v.object({}),
  errors: [],
  emits: [${A}Events.created],
});
`;
    case 'er':
      return `import { defineEventReaction } from 'dmg-core';
import { ${A}ArDef } from '../${c.a}.ar';
import { ${A}Events } from '../${c.a}.events';

export const ${c.defName} = defineEventReaction({
  name: '${camel}',
  label: 'TODO: название реакции',
  description: 'TODO: на что и как реагирует',
  on: [${A}Events.created],
  touches: [${A}ArDef],
  emits: [],
});
`;
    case 'job':
      return `import { defineJob } from 'dmg-core';
import { ${A}ArDef } from '../${c.a}.ar';

export const ${toUpperSnake(c.name)}_HOUR = 3;

export const ${c.defName} = defineJob({
  name: '${camel}',
  label: 'TODO: название задания',
  description: 'TODO: что делает задание',
  schedule: { kind: 'dailyAt', hour: ${toUpperSnake(c.name)}_HOUR, minute: 0 },
  scans: [${A}ArDef],
  emits: [],
});
`;
  }
}

function contractTest(c: Ctx): string {
  return `import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { ${c.defName} } from './${c.base}';

describe('${c.defName}', () => {
  it('нормализуется', () => {
    expect(normalize(${c.defName})).toMatchObject({
      name: '${toCamel(c.name)}',
    });
  });
});
`;
}

/**
 * Импорт Def операции и паспорта модуля (база берёт из него `ref`, D-43):
 * имена по алфавиту, длинная строка — в столбик, как у biome.
 */
function domainImport(c: Ctx): string {
  const names = [c.defName, `${toPascal(c.m)}ModuleDef`].sort();
  const from = `'@u7-scl/domain/${c.m}'`;
  const line = `import { ${names.join(', ')} } from ${from};`;
  return line.length <= 80
    ? line
    : `import {\n${names.map((n) => `  ${n},`).join('\n')}\n} from ${from};`;
}

function implementation(c: Ctx): string {
  const imports = domainImport(c);
  const moduleDef = `${toPascal(c.m)}ModuleDef`;
  const deps = `import type { ${c.deps} } from '../../${c.m}.module';`;
  switch (c.kind) {
    case 'uc':
      return `${imports}
import { ok } from 'dmg-core';
import { UseCaseFromDef } from 'dmg-core/app';
${deps}

export class ${c.className} extends UseCaseFromDef<
  typeof ${c.defName},
  ${c.deps},
  undefined
> {
  constructor(deps: ${c.deps}) {
    super(${c.defName}, deps, ${moduleDef});
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute() {
    // TODO: операция домена и uow.register
    return ok({});
  }
}
`;
    case 'er':
      return `${imports}
import { ok } from 'dmg-core';
import { ReactionFromDef } from 'dmg-core/app';
${deps}

export class ${c.className} extends ReactionFromDef<
  typeof ${c.defName},
  ${c.deps}
> {
  constructor(deps: ${c.deps}) {
    super(${c.defName}, deps, ${moduleDef});
  }

  protected async react() {
    // TODO: операция домена и uow.register
    return ok();
  }
}
`;
    case 'job':
      return `${imports}
import { ok } from 'dmg-core';
import { JobFromDef, type JobReport, type JobRun } from 'dmg-core/app';
${deps}

export class ${c.className} extends JobFromDef<
  typeof ${c.defName},
  ${c.deps}
> {
  constructor(deps: ${c.deps}) {
    super(${c.defName}, deps, ${moduleDef});
  }

  protected async run(job: JobRun): Promise<JobReport> {
    // TODO: загрузить записи и пройти их через job.forEach
    return job.forEach([], async () => ok());
  }
}
`;
  }
}

function implementationTest(c: Ctx): string {
  const head = `import { describe, expect, it } from 'bun:test';
import { testAppContext } from 'dmg-core/testing';
import type { ${c.deps} } from '../../${c.m}.module';
import { ${c.className} } from './${c.base}';
`;
  const deps = `    const { app } = testAppContext();
    // TODO: подставьте репозитории, которые нужны операции
    const deps = { app } as ${c.deps};`;
  switch (c.kind) {
    case 'uc':
      return `import { describe, it } from 'bun:test';
import { UserCaller } from 'dmg-core';
import { requestTrace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import type { ${c.deps} } from '../../${c.m}.module';
import { ${c.className} } from './${c.base}';

describe('${c.className}', () => {
  it('успешный вызов пользователем', async () => {
${deps}
    const uc = new ${c.className}(deps);
    const res = await uc.handle(
      {},
      new UserCaller({ uuid: crypto.randomUUID() }),
      requestTrace({ requestId: 'r-1' }),
    );
    expectOk(res);
  });
});
`;
    case 'er':
      return `${head.replace('import { describe, expect, it }', 'import { describe, expect, it }')}
describe('${c.className}', () => {
  it('привязана к своему Def', () => {
${deps}
    expect(new ${c.className}(deps).def.name).toBe('${toCamel(c.name)}');
  });
});
`;
    case 'job':
      return `import { describe, expect, it } from 'bun:test';
import { jobTrace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import type { ${c.deps} } from '../../${c.m}.module';
import { ${c.className} } from './${c.base}';

describe('${c.className}', () => {
  it('пустой прогон', async () => {
${deps}
    const res = expectOk(await new ${c.className}(deps).handle(jobTrace()));
    expect(res).toEqual({ processed: 0, failed: 0 });
  });
});
`;
  }
}

export function planOperation(args: GenArgs): GenPlan {
  const kind = args.kind as OpKind;
  const { module: m, aggregate: a = '', name = '' } = args;
  const names = kindNames(kind, name);
  const c: Ctx = {
    m,
    a,
    name,
    kind,
    deps: `${toPascal(m)}Deps`,
    agg: toPascal(a),
    className: names.className,
    defName: names.defName,
    base: names.fileName.replace(/\.ts$/, ''),
  };

  const rel = join(a, kind, names.fileName);
  const relBase = `./${a}/${kind}/${c.base}`;
  const domainDir = join(args.domainRoot, m);
  const appDir = join(args.packagesRoot, m, 'src');
  const domainModule = join(domainDir, `${m}.module.ts`);
  const appModule = join(appDir, `${m}.module.ts`);
  const list = LIST[kind];

  const file = (
    root: string,
    ext: '' | '.test',
    content: string,
  ): PlannedFile => ({
    path: join(root, ext === '' ? rel : rel.replace(/\.ts$/, '.test.ts')),
    content,
  });

  return {
    files: [
      file(domainDir, '', contract(c)),
      file(domainDir, '.test', contractTest(c)),
      file(appDir, '', implementation(c)),
      file(appDir, '.test', implementationTest(c)),
    ],
    edits: [
      {
        path: domainModule,
        marker: '// gen:defs:imports',
        line: `import { ${c.defName} } from '${relBase}';`,
      },
      {
        path: domainModule,
        marker: `// gen:defs:${list}`,
        line: `    ${c.defName},`,
      },
      {
        path: join(domainDir, 'index.ts'),
        marker: '// gen:exports',
        line: `export { ${c.defName} } from '${relBase}';`,
      },
      {
        path: appModule,
        marker: '// gen:defs:imports',
        line: `import { ${c.className} } from '${relBase}';`,
      },
      {
        path: appModule,
        marker: `// gen:defs:${list}`,
        line: `    ${toCamel(name)}: ${c.className},`,
      },
    ],
  };
}
