/** `gen uc|er|job <m>.<agg> <name>` — пара контракт ↔ реализация (naming.md §3). */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GenArgs } from '../cli';
import {
  LINE_WIDTH,
  namedImport,
  sortImports,
  sortNames,
} from '../import-order';
import { kindNames, toCamel, toPascal, toUpperSnake } from '../naming';
import type { GenPlan, PlannedFile } from '../plan';
import { fit, list } from '../wrap';

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

/** Имя UC создания агрегата: `create` или `create-…`. */
const isCreate = (name: string) =>
  name === 'create' || name.startsWith('create-');

/**
 * `export const X = Def.define({ … });` в форме biome: шапка в строку, если
 * влезает, иначе перенос после `=` и тело на уровень глубже. `body` — строки
 * объекта по отступу `pad` (переносы по ширине — на своём уровне).
 */
function defineObject(
  name: string,
  call: string,
  body: (pad: string) => string,
): string {
  const head = `export const ${name} = ${call}({`;
  return head.length <= LINE_WIDTH
    ? `${head}\n${body('  ')}\n});`
    : `export const ${name} =\n  ${call}({\n${body('    ')}\n  });`;
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
${list('    ', 'expect(', [`normalize(${c.defName})`], ').toMatchObject({')}
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
   * Шапка класса реализации: база вида с Def, `Deps` и прочими типовыми
   * аргументами — в форме biome.
   */
  protected classHeader(base: string, ...extra: string[]): string {
    const c = this.c;
    return list(
      '',
      `export class ${c.className} extends ${base}<`,
      [`typeof ${c.defName}`, c.deps, ...extra],
      '> {',
      { comma: false },
    );
  }

  /** Конструктор реализации: модуль передаёт себя (D-43), наследник — в `super`. */
  protected get constructorBlock(): string {
    const c = this.c;
    return `${list('  ', 'constructor(', [`deps: ${c.deps}`, `module: typeof ${this.moduleDef}`], ') {')}
    super(${c.defName}, deps, module);
  }`;
  }

  /** `<lhs>new <Класс>(deps, <M>ModuleDef);` с отступом `pad`. */
  protected newImpl(pad: string, lhs: string): string {
    return list(
      pad,
      `${lhs}new ${this.c.className}(`,
      ['deps', this.moduleDef],
      ');',
    );
  }

  /**
   * Импорт Def операции и типа паспорта модуля (его передаёт `ModuleFromDef`,
   * база берёт из него `ref`, D-43).
   */
  private domainImport(): string {
    return namedImport(
      sortNames([this.c.defName, `type ${this.moduleDef}`]),
      this.c.domain,
    );
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
${list('    ', 'const deps = {', ['app', 'facades: new ModuleFacades()'], `} as ${this.c.deps};`, { space: true })}`;
  }
}

/**
 * UC: `UseCaseDef` и реализация на `UseCaseFromDef`. Имя `create` или
 * `create-…` — создание агрегата: заявляет `created` (его публикует
 * `<A>Ar.create`) и создаёт агрегат. Иное — операция над существующим:
 * `load` загружает агрегат по id (`NOT_FOUND`), `emits` пуст до события
 * операции (MAN-06). Репозиторий — `<a>Repo` из `Deps` (`gen aggregate`).
 */
class UseCaseTemplate extends OperationTemplate {
  readonly list = 'useCases';

  private get creates(): boolean {
    return isCreate(this.c.name);
  }

  /** `student` — ключ агрегата в загруженном */
  private get key(): string {
    return toCamel(this.c.a);
  }

  /** `studentId` — id агрегата во входе, выходе и payload ошибки */
  private get idField(): string {
    return `${this.key}Id`;
  }

  /** `studentRepo` — репозиторий агрегата в `Deps` */
  private get repo(): string {
    return `${this.key}Repo`;
  }

  /** Схема `{ <a>Id }` из поля состояния — в строку, в столбик или с переносом значения. */
  private idSchema(pad: string, prop: 'input' | 'output'): string {
    const field = `${this.idField}:`;
    const value = `${this.c.agg}State.entries.uuid`;
    return fit(
      `${pad}${prop}: v.object({ ${field} ${value} }),`,
      `${pad}${prop}: v.object({\n${pad}  ${field} ${value},\n${pad}}),`,
      `${pad}${prop}: v.object({\n${pad}  ${field}\n${pad}    ${value},\n${pad}}),`,
    );
  }

  contract(): string {
    const c = this.c;
    const A = c.agg;
    // Файл агрегата → имя из него: создание публикует событие, операция
    // над существующим отвечает ошибкой «не найден».
    const own: [string, string][] = [
      ['ar', 'ArDef'],
      this.creates ? ['events', 'Events'] : ['errors', 'Errors'],
      ['state', 'State'],
    ];
    const imports = own
      .map(([file, n]) => `import { ${A}${n} } from '../${c.a}.${file}';`)
      .join('\n');
    const io = (pad: string) =>
      this.creates
        ? [
            `${pad}input: v.object({}),`,
            this.idSchema(pad, 'output'),
            `${pad}errors: [],`,
            `${pad}emits: [${A}Events.created],`,
          ]
        : [
            this.idSchema(pad, 'input'),
            `${pad}output: v.object({}),`,
            `${pad}errors: [${A}Errors.NOT_FOUND],`,
            `${pad}// TODO: событие операции — в события агрегата и сюда; объявленное`,
            `${pad}// событие должен кто-то публиковать (MAN-06), \`created\` — UC создания.`,
            `${pad}emits: [],`,
          ];
    const body = (pad: string) =>
      [
        `${pad}name: '${toCamel(c.name)}',`,
        `${pad}label: 'TODO: название операции',`,
        `${pad}description: 'TODO: что делает операция',`,
        `${pad}type: 'command',`,
        `${pad}aggregate: ${A}ArDef,`,
        `${pad}// Раннер каркаса до модуля пользователей вызывает от гостя: добавьте`,
        `${pad}// 'guest' или вызывайте с UserCaller (guides/project.md §7).`,
        `${pad}callers: ['user'],`,
        `${pad}policy: allowAll,`,
        ...io(pad),
      ].join('\n');
    return `import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
${imports}

${defineObject(c.defName, 'UseCaseDef.define', body)}
`;
  }

  implementation(): string {
    const c = this.c;
    const A = c.agg;
    const domainNames = this.creates
      ? [c.defName, `${A}Ar`, `type ${this.moduleDef}`]
      : [c.defName, `type ${A}Ar`, `${A}Errors`, `type ${this.moduleDef}`];
    const imports = sortImports([
      namedImport(sortNames(domainNames), c.domain),
      "import { type Caller, type Identified, ok } from 'dmg-core';",
      "import {\n  type ParsedInputOf,\n  type UnitOfWork,\n  UseCaseFromDef,\n} from 'dmg-core/app';",
      `import type { ${c.deps} } from '../../${c.m}.module';`,
    ]);
    const input = list(
      '',
      'type Input = ParsedInputOf<',
      [`typeof ${c.defName}`],
      '>;',
      {
        comma: false,
      },
    );
    const types = this.creates
      ? input
      : `${input}

/** Загруженное: агрегат операции — его видят Policy и \`execute\`. */
${fit(
  `type Loaded = { readonly ${this.key}: ${A}Ar };`,
  `type Loaded = {\n  readonly ${this.key}: ${A}Ar;\n};`,
)}`;
    return `${imports}

${types}

${this.classHeader('UseCaseFromDef', this.creates ? 'undefined' : 'Loaded')}
${this.constructorBlock}

${this.creates ? this.createBody() : this.updateBody()}
}
`;
  }

  /** `uow.register(<ar>, this.resolve.<a>Repo);` */
  private register(ar: string): string {
    return list(
      '    ',
      'uow.register(',
      [ar, `this.resolve.${this.repo}`],
      ');',
    );
  }

  private createBody(): string {
    const A = this.c.agg;
    return `  protected async load() {
    return ok(undefined);
  }

  protected async execute(
    _input: Input,
    _loaded: undefined,
    uow: UnitOfWork,
    _caller: Caller<Identified>,
  ) {
    // TODO: поля из input — в Create${A}; uuid — снаружи агрегата
${list('    ', `const created = ${A}Ar.create(`, ['{ uuid: crypto.randomUUID() }', 'this.now()'], ');')}
    if (!created.ok) return created;
${this.register('created.value')}
${list('    ', 'return ok({', [`${this.idField}: created.value.uuid`], '});', { space: true })}
  }`;
  }

  private updateBody(): string {
    const A = this.c.agg;
    const key = this.key;
    const id = this.idField;
    const find = `this.resolve.${this.repo}.findById(`;
    const found = `await ${find}${id})`;
    const err = `${A}Errors.NOT_FOUND.err(`;
    return `  protected async load({ ${id} }: Input) {
${fit(
  `    const ${key} = ${found};`,
  `    const ${key} =\n      ${found};`,
  `    const ${key} =\n      await ${find}\n        ${id},\n      );`,
)}
${fit(
  `    return ${key} ? ok({ ${key} }) : ${err}{ ${id} });`,
  `    return ${key}\n      ? ok({ ${key} })\n      : ${err}{ ${id} });`,
  `    return ${key}\n      ? ok({ ${key} })\n      : ${err}{\n          ${id},\n        });`,
)}
  }

  protected async execute(
    _input: Input,
    { ${key} }: Loaded,
    uow: UnitOfWork,
    _caller: Caller<Identified>,
  ) {
    // TODO: операция домена над ${key}, например:
    //   const res = ${key}.complete(this.now());
    //   if (!res.ok) return res;
${this.register(key)}
    return ok({});
  }`;
  }

  implementationTest(): string {
    return this.creates ? this.createTest() : this.updateTest();
  }

  /** Импорты теста: временный каталог и JSON-репозиторий агрегата. */
  private repoTestImports(
    test: string,
    domain: string[],
    check: string,
  ): string {
    const c = this.c;
    return sortImports([
      `import { ${test} } from 'bun:test';`,
      "import { mkdtempSync, rmSync } from 'node:fs';",
      "import { tmpdir } from 'node:os';",
      "import { join } from 'node:path';",
      namedImport(sortNames([...domain, this.moduleDef]), c.domain),
      "import { UserCaller } from 'dmg-core';",
      "import { ModuleFacades, Trace } from 'dmg-core/app';",
      `import { ${check} } from 'dmg-core/testing';`,
      `import { ${c.agg}JsonRepo } from '../../infra/${c.a}.json-repo';`,
      `import type { ${c.deps} } from '../../${c.m}.module';`,
      `import { ${c.className} } from './${c.base}';`,
    ]);
  }

  /** Резолвер с JSON-репозиторием во временном каталоге — до каждого теста. */
  private get repoSetup(): string {
    const c = this.c;
    return `const user = new UserCaller({ uuid: crypto.randomUUID() });
const trace = Trace.fromRequest({ requestId: 'r-1' });

let dir: string;
let repo: ${c.agg}JsonRepo;
let uc: ${c.className};
beforeEach(() => {
${list('  ', 'dir = mkdtempSync(', [`join(tmpdir(), '${c.name}-')`], ');')}
${list('  ', `repo = new ${c.agg}JsonRepo(`, [`join(dir, '${c.a}.json')`], ');')}
  // Остальные зависимости модуля — по мере надобности операции.
  const deps = {
    app: testAppContext().app,
    facades: new ModuleFacades(),
    ${this.repo}: repo,
  } as ${c.deps};
${this.newImpl('  ', 'uc = ')}
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));`;
  }

  private createTest(): string {
    const c = this.c;
    return `${this.repoTestImports(
      'afterEach, beforeEach, describe, expect, it',
      [],
      'expectOk, testAppContext',
    )}

${this.repoSetup}

describe('${c.className}', () => {
  it('создаёт агрегат и сохраняет его', async () => {
    const out = expectOk(await uc.handle({}, user, trace));
${list('    ', 'expect(', [`await repo.findById(out.${this.idField})`], ').toBeDefined();')}
  });
});
`;
  }

  private updateTest(): string {
    const c = this.c;
    const A = c.agg;
    const code = `${toUpperSnake(c.a)}_NOT_FOUND`;
    return `${this.repoTestImports(
      'afterEach, beforeEach, describe, expect, it',
      [`${A}Ar`],
      'expectErr, expectOk, testAppContext',
    )}

const ID = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const T0 = Date.UTC(2026, 9, 1);
const input = { ${this.idField}: ID };
${this.repoSetup}

describe('${c.className}', () => {
  it('загружает агрегат и сохраняет его', async () => {
${list('    ', 'const ar = expectOk(', [`${A}Ar.create({ uuid: ID }, T0)`], ');')}
    await repo.save(ar);
    expectOk(await uc.handle(input, user, trace));
  });

  it('нет агрегата — ${code}', async () => {
    const res = await uc.handle(input, user, trace);
${list('    ', 'const error = expectErr(', ['res', `'${code}'`], ');')}
    expect(error.payload).toEqual(input);
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
    const body = (pad: string) =>
      [
        `${pad}name: '${toCamel(c.name)}',`,
        `${pad}label: 'TODO: название реакции',`,
        `${pad}description: 'TODO: на что и как реагирует',`,
        `${pad}// \`created\` публикует UC создания, иначе реакция висит без`,
        `${pad}// издателя (MAN-06): gen uc ${c.m}.${c.a} create`,
        `${pad}on: [${A}Events.created],`,
        `${pad}touches: [${A}ArDef],`,
        `${pad}// События реакции — в события агрегата и сюда; объявленное событие`,
        `${pad}// должен кто-то публиковать (MAN-06).`,
        `${pad}emits: [],`,
      ].join('\n');
    return `import { EventReactionDef } from 'dmg-core';
import { ${A}ArDef } from '../${c.a}.ar';
import { ${A}Events } from '../${c.a}.events';

${defineObject(c.defName, 'EventReactionDef.define', body)}
`;
  }

  implementation(): string {
    return `${this.implementationImports("import { ReactionFromDef } from 'dmg-core/app';")}

${this.classHeader('ReactionFromDef')}
${this.constructorBlock}

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
${this.newImpl('    ', 'const er = ')}
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
    const body = (pad: string) =>
      [
        `${pad}name: '${toCamel(c.name)}',`,
        `${pad}label: 'TODO: название задания',`,
        `${pad}description: 'TODO: что делает задание',`,
        list(
          pad,
          'schedule: {',
          ["kind: 'dailyAt'", `hour: ${hour}`, 'minute: 0'],
          '},',
          {
            space: true,
          },
        ),
        `${pad}scans: [${c.agg}ArDef],`,
        `${pad}// События задания — в события агрегата и сюда; объявленное событие`,
        `${pad}// должен кто-то публиковать (MAN-06).`,
        `${pad}emits: [],`,
      ].join('\n');
    return `import { JobDef } from 'dmg-core';
import { ${c.agg}ArDef } from '../${c.a}.ar';

export const ${hour} = 3;

${defineObject(c.defName, 'JobDef.define', body)}
`;
  }

  implementation(): string {
    return `${this.implementationImports(
      "import { JobFromDef, type JobReport, type JobRun } from 'dmg-core/app';",
    )}

${this.classHeader('JobFromDef')}
${this.constructorBlock}

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
${this.newImpl('    ', 'const job = ')}
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

/**
 * Подсказка MAN-06: операция без UC создания в каталоге агрегата оставляет
 * `created` без издателя — arch-check красный, пока его нет. Наличие — по
 * файлу `create.uc.ts` или `create-*.uc.ts`.
 */
function createNotes(args: GenArgs, kind: OpKind): string[] {
  const { module: m, aggregate: a = '', name = '' } = args;
  const listensCreated = kind === 'er' || (kind === 'uc' && !isCreate(name));
  if (!listensCreated) return [];
  const dir = join(args.layout.domainDir(m), a, 'uc');
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const hasCreate = files.some((f) => /^create(-.+)?\.uc\.ts$/.test(f));
  return hasCreate ? [] : [createdNote(m, a)];
}

/** Подсказка: событие `created` публикует UC создания (MAN-06). */
export const createdNote = (m: string, a: string): string =>
  `Событие created публикует UC создания (MAN-06): dmg-core gen uc ${m}.${a} create`;

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
        line: fit(
          `    ${toCamel(name)}: ${c.className},`,
          `    ${toCamel(name)}:\n      ${c.className},`,
        ),
      },
    ],
    notes: createNotes(args, kind),
  };
}
