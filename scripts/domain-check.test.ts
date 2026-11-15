import { describe, expect, it } from 'bun:test';
import { ModuleDef } from 'dmg-core';
import {
  checkContractImports,
  checkDomainDirs,
  checkDomainGraph,
  checkDomainImports,
  checkModuleImports,
  type DomainFile,
  domainGraphOf,
} from './domain-check';

const DEPENDS = { user: [], course: ['user'], stream: ['course'] };

const file = (path: string, text: string): DomainFile => ({ path, text });

describe('checkDomainImports: ARC-04 / ARC-06', () => {
  it('корень модуля из dependsOn без подпути — ARC-04 (только contract)', () => {
    const files = [
      file(
        'domain/src/course/a.ts',
        "import { U } from '../user';\nimport { V } from '@u7-scl/domain/user';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-04: domain/src/course/a.ts: чужой модуль user — только через contract (import '../user')",
      "ARC-04: domain/src/course/a.ts: чужой модуль user — только через contract (import '@u7-scl/domain/user')",
    ]);
  });

  it('подпуть index чужого модуля — ARC-04', () => {
    const files = [
      file('domain/src/course/a.ts', "import { U } from '../user/index';"),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-04: domain/src/course/a.ts: чужой модуль user — только через contract (import '../user/index')",
    ]);
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
      "ARC-04: domain/src/course/a.ts: чужой модуль user — только через contract (import '../user/state')",
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

  it('относительный путь ../user/contract разрешён публичным', () => {
    const files = [
      file('domain/src/course/a.ts', "import { U } from '../user/contract';"),
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
      "ARC-04: domain/src/course/a.ts: чужой модуль user — только через contract (import '@u7-scl/domain/user/state')",
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
        "import { X } from '../../../user/src/infra/repo';\nimport { B } from '@u7-scl/bot';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-06: domain/src/user/a.ts: домен не импортирует прикладной слой (import '../../../user/src/infra/repo')",
      "ARC-06: domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/bot')",
    ]);
  });

  it('корень сборки @u7-scl/app — ARC-06, маркер DEBT не спасает', () => {
    const files = [
      file(
        'domain/src/user/a.ts',
        "import { A } from '@u7-scl/app'; // C-DEBT-1",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-06: domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/app')",
    ]);
  });

  it('core без маркера DEBT — не ошибка (ARC-02 — через DebtChecker)', () => {
    const files = [
      file('domain/src/user/a.ts', "import { A } from '@u7-scl/core';"),
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

  it('общий домен shared — любому модулю, без dependsOn и подпути', () => {
    const files = [
      file(
        'domain/src/user/user/a.ts',
        "import { Z } from '../../shared';\nimport { Y } from '@u7-scl/domain/shared';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });

  it('общий домен shared сам модули не импортирует — ARC-04', () => {
    const files = [
      file('domain/src/shared/a.ts', "import { U } from '../user/contract';"),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-04: domain/src/shared/a.ts: модуль shared не зависит от user (import '../user/contract')",
    ]);
  });

  it('файлы вне domain/src/<m>/ игнорируются', () => {
    const files = [file('modules/user/src/a.ts', "import '@u7-scl/core';")];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });
});

describe('подпуть @u7-scl/domain/<m>/testing: публичный, но только тестам (TST-07)', () => {
  const TESTING = "import { userSubject } from '@u7-scl/domain/user/testing';";

  it('checkDomainImports: testing чужого модуля из dependsOn — не ARC-04', () => {
    const files = [file('domain/src/course/module/a.policy.test.ts', TESTING)];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });

  it('checkContractImports: testing модуля на Def — не ARC-04', () => {
    const files = [
      file('modules/course/src/module/uc/module-uc.fixture.ts', TESTING),
    ];
    expect(checkContractImports(files, ['user', 'course'])).toEqual([]);
  });
});

describe('checkModuleImports: ARC-06 (D-53)', () => {
  // Пакеты корня сборки и раннеров — из package.json (`assemblyPackages`).
  const ASSEMBLY = ['@u7-scl/app', '@u7-scl/bot'];

  it('пакет нового раннера из списка — ARC-06', () => {
    const files = [
      file('modules/user/src/a.ts', "import { W } from '@u7-scl/web/x';"),
    ];
    expect(checkModuleImports(files, [...ASSEMBLY, '@u7-scl/web'])).toEqual([
      "ARC-06: modules/user/src/a.ts: прикладной пакет не импортирует корень сборки и раннеры (import '@u7-scl/web/x')",
    ]);
  });

  it('платформа, домен и пакеты модулей — без нарушений', () => {
    const files = [
      file(
        'modules/wish/src/a.ts',
        "import { C } from '@u7-scl/core';\nimport { W } from '@u7-scl/domain/wish';\nimport { R } from './wish/wish.repo';",
      ),
    ];
    expect(checkModuleImports(files, ASSEMBLY)).toEqual([]);
  });

  it('корень сборки @u7-scl/app — ARC-06, маркер DEBT не спасает', () => {
    const files = [
      file(
        'modules/user/src/a.ts',
        "import { A } from '@u7-scl/app'; // C-DEBT-1\nimport { B } from '@u7-scl/app/u7-app';",
      ),
    ];
    expect(checkModuleImports(files, ASSEMBLY)).toEqual([
      "ARC-06: modules/user/src/a.ts: прикладной пакет не импортирует корень сборки и раннеры (import '@u7-scl/app')",
      "ARC-06: modules/user/src/a.ts: прикладной пакет не импортирует корень сборки и раннеры (import '@u7-scl/app/u7-app')",
    ]);
  });

  it('раннеры пакетом и относительным путём — ARC-06', () => {
    const files = [
      file(
        'modules/user/src/infra/a.ts',
        "import { B } from '@u7-scl/bot';\nimport { M } from '../../../../runners/u7-bot/src/main';\nimport { U } from '../../../../platform/app/src/u7-app';",
      ),
    ];
    expect(checkModuleImports(files, ASSEMBLY)).toEqual([
      "ARC-06: modules/user/src/infra/a.ts: прикладной пакет не импортирует корень сборки и раннеры (import '@u7-scl/bot')",
      "ARC-06: modules/user/src/infra/a.ts: прикладной пакет не импортирует корень сборки и раннеры (import '../../../../runners/u7-bot/src/main')",
      "ARC-06: modules/user/src/infra/a.ts: прикладной пакет не импортирует корень сборки и раннеры (import '../../../../platform/app/src/u7-app')",
    ]);
  });

  it('файлы вне modules/ не проверяются', () => {
    const files = [
      file('runners/u7-bot/src/a.ts', "import { A } from '@u7-scl/app';"),
    ];
    expect(checkModuleImports(files, ASSEMBLY)).toEqual([]);
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
  const mod = (
    name: string,
    dependsOn: ReturnType<typeof ModuleDef.define>[],
  ) =>
    ModuleDef.define({
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

  it('общий домен shared — не модуль, ModuleDef не нужен', () => {
    expect(checkDomainDirs(['user', 'shared'], DEPENDS)).toEqual([]);
  });
});

describe('checkContractImports: ARC-04 (D-45)', () => {
  const MODULES = ['user', 'wish'];
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

  it('общий домен shared снаружи — напрямую, не модуль', () => {
    expect(
      run(
        'platform/app/src/a.ts',
        "import { Z } from '@u7-scl/domain/shared';",
      ),
    ).toEqual([]);
  });

  it('scripts/ — вне ARC-04: полный вход модуля на Def разрешён', () => {
    expect(
      run('scripts/x.ts', "import { S } from '@u7-scl/domain/wish';"),
    ).toEqual([]);
    expect(
      run('modules/user/src/a.ts', "import { S } from '@u7-scl/domain/wish';"),
    ).toEqual([
      "ARC-04: modules/user/src/a.ts: модуль wish — только через contract (import '@u7-scl/domain/wish')",
    ]);
  });
});
