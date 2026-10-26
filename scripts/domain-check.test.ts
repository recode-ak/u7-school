import { describe, expect, it } from 'bun:test';
import { defineModule } from 'dmg-core';
import {
  checkContractImports,
  checkDebt,
  checkDomainDirs,
  checkDomainGraph,
  checkDomainImports,
  type DomainFile,
  domainGraphOf,
} from './domain-check';

const DEPENDS = { user: [], course: ['user'], stream: ['course'] };

const file = (path: string, text: string): DomainFile => ({ path, text });

describe('checkDomainImports: ARC-04 / ARC-06', () => {
  it('импорт модуля из dependsOn через index — без нарушений', () => {
    const files = [
      file(
        'domain/src/course/a.ts',
        "import { U } from '../user';\nimport { V } from '@u7-scl/domain/user';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });

  it('импорт модуля вне dependsOn — ARC-04', () => {
    const files = [
      file('domain/src/user/a.ts', "import { C } from '../course';"),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-04: domain/src/user/a.ts: модуль user не зависит от course (import '../course')",
    ]);
  });

  it('импорт внутренностей чужого модуля — ARC-04', () => {
    const files = [
      file('domain/src/course/a.ts', "import { U } from '../user/state';"),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-04: domain/src/course/a.ts: чужой модуль user — только через contract, index — по DEBT-34 (import '../user/state')",
    ]);
  });

  it('подпуть @u7-scl/domain/<m>/contract разрешён публичным', () => {
    const files = [
      file(
        'domain/src/course/a.ts',
        "import { U } from '@u7-scl/domain/user/contract';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });

  it('подпуть /state не публичный (D-45) — ARC-04', () => {
    const files = [
      file(
        'domain/src/course/a.ts',
        "import { U } from '@u7-scl/domain/user/state';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-04: domain/src/course/a.ts: чужой модуль user — только через contract, index — по DEBT-34 (import '@u7-scl/domain/user/state')",
    ]);
  });

  it('импорт прикладного пакета модуля — ARC-06', () => {
    const files = [
      file('domain/src/user/a.ts', "import { X } from '@u7-scl/user';"),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-06: domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/user')",
    ]);
  });

  it('импорт ui / infra / apps — ARC-06', () => {
    const files = [
      file(
        'domain/src/user/a.ts',
        "import { X } from '../../../user/src/infra/repo';\nimport { B } from '@u7-scl/bot';\nimport { Y } from '@u7-scl/cli';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-06: domain/src/user/a.ts: домен не импортирует прикладной слой (import '../../../user/src/infra/repo')",
      "ARC-06: domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/bot')",
      "ARC-06: domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/cli')",
    ]);
  });

  it('app/core без маркера DEBT — ARC-02', () => {
    const files = [
      file(
        'domain/src/user/a.ts',
        "import { A } from '@u7-scl/app';\nimport { C } from '@u7-scl/core';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-02: domain/src/user/a.ts: импорт '@u7-scl/app' без // DEBT-<n>",
      "ARC-02: domain/src/user/a.ts: импорт '@u7-scl/core' без // DEBT-<n>",
    ]);
  });

  it('app/core с маркером DEBT в той же строке или строкой выше — ок', () => {
    const files = [
      file(
        'domain/src/user/a.ts',
        "import { A } from '@u7-scl/app'; // DEBT-1\n// DEBT-2\nimport { C } from '@u7-scl/core';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });

  it('многострочный import и export from разбираются', () => {
    const files = [
      file(
        'domain/src/user/a.ts',
        "import {\n  A,\n  B,\n} from '../course';\nexport * from '../stream';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toHaveLength(2);
  });

  it('файлы вне domain/src/<m>/ игнорируются', () => {
    const files = [file('modules/user/src/a.ts', "import '@u7-scl/app';")];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });
});

describe('checkDomainGraph: ARC-05', () => {
  it('DAG — без нарушений', () => {
    expect(checkDomainGraph(DEPENDS)).toEqual([]);
  });

  it('цикл — ARC-05 с путём', () => {
    expect(checkDomainGraph({ a: ['b'], b: ['c'], c: ['a'] })).toEqual([
      'ARC-05: цикл в dependsOn: a → b → c → a',
    ]);
  });

  it('зависимость от неизвестного модуля — ARC-05', () => {
    expect(checkDomainGraph({ a: ['x'] })).toEqual([
      'ARC-05: модуль a зависит от неизвестного модуля x',
    ]);
  });
});

describe('domainGraphOf: граф из ModuleDef', () => {
  const mod = (name: string, dependsOn: ReturnType<typeof defineModule>[]) =>
    defineModule({
      name,
      label: name,
      description: `Модуль ${name}.`,
      external: true,
      dependsOn,
      aggregates: [],
      useCases: [],
      reactions: [],
      jobs: [],
    });

  it('прямые зависимости — по именам из dependsOn', () => {
    const user = mod('user', []);
    const course = mod('course', [user]);
    expect(domainGraphOf([user, course])).toEqual({
      user: [],
      course: ['user'],
    });
  });
});

describe('checkDomainDirs: ARC-05', () => {
  it('каждый каталог домена — модуль графа', () => {
    expect(checkDomainDirs(['user', 'course'], DEPENDS)).toEqual([]);
  });

  it('каталог без ModuleDef — ARC-05', () => {
    expect(checkDomainDirs(['user', 'billing'], DEPENDS)).toEqual([
      'ARC-05: domain/src/billing: нет ModuleDef в графе домена',
    ]);
  });
});

describe('checkContractImports: ARC-04 (D-45)', () => {
  const MODULES = { all: ['user', 'wish'], dmg: ['wish'] };
  const run = (path: string, text: string) =>
    checkContractImports([file(path, text)], MODULES);

  it('модуль на Def снаружи — только через contract', () => {
    expect(
      run(
        'runners/bot/src/a.ts',
        "import { D } from '@u7-scl/domain/wish/contract';",
      ),
    ).toEqual([]);
    expect(
      run('runners/bot/src/a.ts', "import { D } from '@u7-scl/domain/wish';"),
    ).toEqual([
      "ARC-04: runners/bot/src/a.ts: модуль wish — только через contract (import '@u7-scl/domain/wish')",
    ]);
  });

  it('свой домен и свой прикладной пакет — через index', () => {
    expect(
      run('modules/wish/src/a.ts', "import { A } from '@u7-scl/domain/wish';"),
    ).toEqual([]);
    expect(
      run('domain/src/wish/a.ts', "import { A } from '@u7-scl/domain/wish';"),
    ).toEqual([]);
  });

  it('модуль на Def импортирует чужой legacy — тоже только contract', () => {
    expect(
      run('domain/src/wish/a.ts', "import { U } from '@u7-scl/domain/user';"),
    ).toEqual([
      "ARC-04: domain/src/wish/a.ts: модуль user — только через contract (import '@u7-scl/domain/user')",
    ]);
    expect(
      run('modules/wish/src/a.ts', "import { U } from '@u7-scl/domain/user';"),
    ).toEqual([
      "ARC-04: modules/wish/src/a.ts: модуль user — только через contract (import '@u7-scl/domain/user')",
    ]);
  });

  it('state, export from и import() модуля на Def — ARC-04', () => {
    expect(
      run(
        'runners/bot/src/a.ts',
        "import { S } from '@u7-scl/domain/wish/state';\nexport { A } from '@u7-scl/domain/wish';\nawait import('@u7-scl/domain/wish');",
      ),
    ).toEqual([
      "ARC-04: runners/bot/src/a.ts: модуль wish — только через contract (import '@u7-scl/domain/wish/state')",
      "ARC-04: runners/bot/src/a.ts: модуль wish — только через contract (import '@u7-scl/domain/wish')",
      "ARC-04: runners/bot/src/a.ts: модуль wish — только через contract (import '@u7-scl/domain/wish')",
    ]);
  });

  it('общий код домена (shared) — тоже только contract', () => {
    expect(
      run('domain/src/shared/a.ts', "import { A } from '@u7-scl/domain/wish';"),
    ).toEqual([
      "ARC-04: domain/src/shared/a.ts: модуль wish — только через contract (import '@u7-scl/domain/wish')",
    ]);
  });

  it('пары legacy-модулей не проверяются (долг до миграции)', () => {
    expect(
      run('runners/bot/src/a.ts', "import { U } from '@u7-scl/domain/user';"),
    ).toEqual([]);
  });
});

describe('checkDebt: сверка маркеров в коде и debt.md', () => {
  const md = (...ids: string[]) => ids.map((id) => `### ${id}: x\n`).join('\n');
  const at = (id: string) => [
    file('domain/src/user/a.ts', `// ${id}: причина`),
  ];

  it('всё согласовано — без нарушений', () => {
    const code = [
      file('domain/src/user/a.ts', '// DEBT-1'),
      file('modules/user/src/domain/index.ts', '// DEBT-2 — barrel'),
    ];
    expect(checkDebt({ code, debtMd: md('DEBT-1', 'DEBT-2') })).toEqual([]);
  });

  it('маркер в коде без записи в debt.md', () => {
    expect(checkDebt({ code: at('DEBT-3'), debtMd: md() })).toEqual([
      'DEBT: DEBT-3 есть в коде (domain/src/user/a.ts), но нет записи в debt.md',
    ]);
  });

  it('запись в debt.md без маркера (долг погашен, запись осталась)', () => {
    expect(
      checkDebt({ code: at('DEBT-1'), debtMd: md('DEBT-1', 'DEBT-2') }),
    ).toEqual(['DEBT: DEBT-2 есть в debt.md, но нет маркера в коде']);
  });

  it('старый формат D-<n> не считается маркером', () => {
    expect(checkDebt({ code: at('D-1'), debtMd: md() })).toEqual([]);
  });
});
