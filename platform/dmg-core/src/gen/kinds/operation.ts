/** `gen uc|er|job <m>.<agg> <name>` — пара контракт ↔ реализация (naming.md §3). */
import { join } from 'node:path';
import type { GenArgs } from '../cli';
import { sortImports } from '../import-order';
import { kindNames, toCamel, toPascal, toUpperSnake } from '../naming';
import type { GenPlan, PlannedFile } from '../plan';

type OpKind = 'uc' | 'er' | 'job';

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
  /** Спецификатор импорта домена из каталога реализации */
  domain: string;
}

/**
 * Шаблоны файлов операции одного вида: контракт в домене, реализация в
 * прикладном слое и их тесты. Вид — строка CLI (`uc|er|job`): шаблон
 * выбирается таблицей `TEMPLATES`, а не `switch`.
 */
abstract class OperationTemplate {
  constructor(protected readonly c: Ctx) {}

  /** Маркер списка в паспорте и карте модуля. */
  abstract readonly list: string;

  abstract contract(): string;

  abstract implementation(): string;

  abstract implementationTest(): string;

  contractTest(): string {
    const c = this.c;
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

  protected get moduleDef(): string {
    return `${toPascal(this.c.m)}ModuleDef`;
  }

  /**
   * Импорт Def операции и типа паспорта модуля (его передаёт `ModuleFromDef`,
   * база берёт из него `ref`, D-43): имена по алфавиту, длинная строка — в
   * столбик, как у biome.
   */
  private domainImport(): string {
    const moduleDef = this.moduleDef;
    const names = [this.c.defName, moduleDef]
      .sort()
      .map((n) => (n === moduleDef ? `type ${n}` : n));
    const from = `'${this.c.domain}'`;
    const line = `import { ${names.join(', ')} } from ${from};`;
    return line.length <= 80
      ? line
      : `import {\n${names.map((n) => `  ${n},`).join('\n')}\n} from ${from};`;
  }

  /** Импорты реализации: Def и паспорт, `ok`, база вида, `Deps` модуля. */
  protected implementationImports(...lines: string[]): string {
    return sortImports([
      this.domainImport(),
      "import { ok } from 'dmg-core';",
      ...lines,
      `import type { ${this.c.deps} } from '../../${this.c.m}.module';`,
    ]);
  }

  /** Импорты теста реализации. */
  protected testImports(test: string, ...lines: string[]): string {
    const c = this.c;
    return sortImports([
      `import { ${test} } from 'bun:test';`,
      `import { ${this.moduleDef} } from '${c.domain}';`,
      ...lines,
      `import type { ${c.deps} } from '../../${c.m}.module';`,
      `import { ${c.className} } from './${c.base}';`,
    ]);
  }

  /** Заготовка `deps` в тесте реализации. */
  protected get testDeps(): string {
    return `    const { app } = testAppContext();
    // TODO: подставьте репозитории и фасады, которые нужны операции
    const deps = { app, facades: new ModuleFacades() } as ${this.c.deps};`;
  }
}

/** UC: `UseCaseDef` и реализация на `UseCaseFromDef`. */
class UseCaseTemplate extends OperationTemplate {
  readonly list = 'useCases';

  contract(): string {
    const c = this.c;
    const A = c.agg;
    return `import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ${A}ArDef } from '../${c.a}.ar';
import { ${A}Events } from '../${c.a}.events';

export const ${c.defName} = UseCaseDef.define({
  name: '${toCamel(c.name)}',
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
  }

  implementation(): string {
    const c = this.c;
    return `${this.implementationImports("import { UseCaseFromDef } from 'dmg-core/app';")}

export class ${c.className} extends UseCaseFromDef<
  typeof ${c.defName},
  ${c.deps},
  undefined
> {
  constructor(deps: ${c.deps}, module: typeof ${this.moduleDef}) {
    super(${c.defName}, deps, module);
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
  }

  implementationTest(): string {
    const c = this.c;
    return `${this.testImports(
      'describe, it',
      "import { UserCaller } from 'dmg-core';",
      "import { ModuleFacades, Trace } from 'dmg-core/app';",
      "import { expectOk, testAppContext } from 'dmg-core/testing';",
    )}

describe('${c.className}', () => {
  it('успешный вызов пользователем', async () => {
${this.testDeps}
    const uc = new ${c.className}(deps, ${this.moduleDef});
    const res = await uc.handle(
      {},
      new UserCaller({ uuid: crypto.randomUUID() }),
      Trace.fromRequest({ requestId: 'r-1' }),
    );
    expectOk(res);
  });
});
`;
  }
}

/** ER: `EventReactionDef` и реализация на `ReactionFromDef`. */
class ReactionTemplate extends OperationTemplate {
  readonly list = 'reactions';

  contract(): string {
    const c = this.c;
    const A = c.agg;
    return `import { EventReactionDef } from 'dmg-core';
import { ${A}ArDef } from '../${c.a}.ar';
import { ${A}Events } from '../${c.a}.events';

export const ${c.defName} = EventReactionDef.define({
  name: '${toCamel(c.name)}',
  label: 'TODO: название реакции',
  description: 'TODO: на что и как реагирует',
  on: [${A}Events.created],
  touches: [${A}ArDef],
  emits: [],
});
`;
  }

  implementation(): string {
    const c = this.c;
    return `${this.implementationImports("import { ReactionFromDef } from 'dmg-core/app';")}

export class ${c.className} extends ReactionFromDef<
  typeof ${c.defName},
  ${c.deps}
> {
  constructor(deps: ${c.deps}, module: typeof ${this.moduleDef}) {
    super(${c.defName}, deps, module);
  }

  protected async react() {
    // TODO: операция домена и uow.register
    return ok();
  }
}
`;
  }

  implementationTest(): string {
    const c = this.c;
    return `${this.testImports(
      'describe, expect, it',
      "import { ModuleFacades } from 'dmg-core/app';",
      "import { testAppContext } from 'dmg-core/testing';",
    )}

describe('${c.className}', () => {
  it('привязана к своему Def', () => {
${this.testDeps}
    const er = new ${c.className}(deps, ${this.moduleDef});
    expect(er.def.name).toBe('${toCamel(c.name)}');
  });
});
`;
  }
}

/** Job: `JobDef` и реализация на `JobFromDef`. */
class JobTemplate extends OperationTemplate {
  readonly list = 'jobs';

  contract(): string {
    const c = this.c;
    const hour = `${toUpperSnake(c.name)}_HOUR`;
    return `import { JobDef } from 'dmg-core';
import { ${c.agg}ArDef } from '../${c.a}.ar';

export const ${hour} = 3;

export const ${c.defName} = JobDef.define({
  name: '${toCamel(c.name)}',
  label: 'TODO: название задания',
  description: 'TODO: что делает задание',
  schedule: { kind: 'dailyAt', hour: ${hour}, minute: 0 },
  scans: [${c.agg}ArDef],
  emits: [],
});
`;
  }

  implementation(): string {
    const c = this.c;
    return `${this.implementationImports(
      "import { JobFromDef, type JobReport, type JobRun } from 'dmg-core/app';",
    )}

export class ${c.className} extends JobFromDef<
  typeof ${c.defName},
  ${c.deps}
> {
  constructor(deps: ${c.deps}, module: typeof ${this.moduleDef}) {
    super(${c.defName}, deps, module);
  }

  protected async run(job: JobRun): Promise<JobReport> {
    // TODO: загрузить записи и пройти их через job.forEach
    return job.forEach([], async () => ok());
  }
}
`;
  }

  implementationTest(): string {
    const c = this.c;
    return `${this.testImports(
      'describe, expect, it',
      "import { ModuleFacades, Trace } from 'dmg-core/app';",
      "import { expectOk, testAppContext } from 'dmg-core/testing';",
    )}

describe('${c.className}', () => {
  it('пустой прогон', async () => {
${this.testDeps}
    const job = new ${c.className}(deps, ${this.moduleDef});
    const res = expectOk(await job.handle(Trace.forJob(job.def)));
    expect(res).toEqual({ processed: 0, failed: 0 });
  });
});
`;
  }
}

/** Шаблон операции по виду CLI. */
const TEMPLATES: Record<OpKind, new (c: Ctx) => OperationTemplate> = {
  uc: UseCaseTemplate,
  er: ReactionTemplate,
  job: JobTemplate,
};

export function planOperation(args: GenArgs): GenPlan {
  const kind = args.kind as OpKind;
  const { module: m, aggregate: a = '', name = '' } = args;
  const names = kindNames(kind, name);
  const domainDir = args.layout.domainDir(m);
  const appDir = args.layout.appDir(m);
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
    domain: args.layout.domainImport(m, join(appDir, a, kind)),
  };
  const t = new TEMPLATES[kind](c);

  const rel = join(a, kind, names.fileName);
  const relBase = `./${a}/${kind}/${c.base}`;
  const domainModule = join(domainDir, `${m}.module.ts`);
  const appModule = join(appDir, `${m}.module.ts`);

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
      file(domainDir, '', t.contract()),
      file(domainDir, '.test', t.contractTest()),
      file(appDir, '', t.implementation()),
      file(appDir, '.test', t.implementationTest()),
    ],
    edits: [
      {
        path: domainModule,
        marker: '// gen:defs:imports',
        line: `import { ${c.defName} } from '${relBase}';`,
      },
      {
        path: domainModule,
        marker: `// gen:defs:${t.list}`,
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
        marker: `// gen:defs:${t.list}`,
        line: `    ${toCamel(name)}: ${c.className},`,
      },
    ],
  };
}
