import { describe, expect, it } from 'bun:test';
import { ModuleDef } from 'dmg-core';
import {
  checkContractImports,
  checkDebt,
  checkDomainDirs,
  checkDomainGraph,
  checkDomainImports,
  checkModuleImports,
  checkTrMarkers,
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
      "ARC-04: domain/src/course/a.ts: чужой модуль user — только через contract или index (import '../user/state')",
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
      "ARC-04: domain/src/course/a.ts: чужой модуль user — только через contract или index (import '@u7-scl/domain/user/state')",
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

  it('корень сборки @u7-scl/app — ARC-06, маркер DEBT не спасает', () => {
    const files = [
      file(
        'domain/src/user/a.ts',
        "import { A } from '@u7-scl/app'; // DEBT-1",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-06: domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/app')",
    ]);
  });

  it('app-legacy/core без маркера DEBT — не ошибка (ARC-02 — через checkDebt)', () => {
    const files = [
      file(
        'domain/src/user/a.ts',
        "import { A } from '@u7-scl/app-legacy';\nimport { C } from '@u7-scl/core';",
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
    const files = [
      file('modules/user/src/a.ts', "import '@u7-scl/app-legacy';"),
    ];
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
    expect(
      checkContractImports(files, {
        all: ['user', 'course'],
        dmg: ['user', 'course'],
      }),
    ).toEqual([]);
  });
});

describe('checkModuleImports: ARC-06 (D-53)', () => {
  // Пакеты корня сборки и раннеров — из package.json (`assemblyPackages`).
  const ASSEMBLY = ['@u7-scl/app', '@u7-scl/bot', '@u7-scl/cli'];

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
        "import { A } from '@u7-scl/app-legacy';\nimport { C } from '@u7-scl/core';\nimport { W } from '@u7-scl/domain/wish';\nimport { R } from './wish/wish.repo';",
      ),
    ];
    expect(checkModuleImports(files, ASSEMBLY)).toEqual([]);
  });

  it('корень сборки @u7-scl/app — ARC-06, маркер DEBT не спасает', () => {
    const files = [
      file(
        'modules/user/src/a.ts',
        "import { A } from '@u7-scl/app'; // DEBT-1\nimport { B } from '@u7-scl/app/u7-app';",
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
        "import { B } from '@u7-scl/bot';\nimport { C } from '@u7-scl/cli';\nimport { M } from '../../../../runners/u7-bot/src/main';\nimport { U } from '../../../../platform/app/src/u7-app';",
      ),
    ];
    expect(checkModuleImports(files, ASSEMBLY)).toEqual([
      "ARC-06: modules/user/src/infra/a.ts: прикладной пакет не импортирует корень сборки и раннеры (import '@u7-scl/bot')",
      "ARC-06: modules/user/src/infra/a.ts: прикладной пакет не импортирует корень сборки и раннеры (import '@u7-scl/cli')",
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

describe('checkDebt: allowlist долгов в debt.md', () => {
  const CORE = "import { A } from '@u7-scl/core';";
  const LEGACY = "import { L } from '@u7-scl/app-legacy/domain';";
  const ISO =
    '  // biome-ignore lint/plugin: DEBT-5 — дата\n  at: v.isoDateTime(),';

  /** DEBT-1 — слитая запись: два glob со своим «Погашает», Корень — домен. */
  const DEBT_1 = [
    '### DEBT-1: импорты `@u7-scl/core` в домене',
    '- **Место:**',
    '  - `domain/src/user/**` — погашает: перевод `user` на Def',
    '  - `domain/src/course/**` — погашает: перевод `course` на Def',
    "- **Признак:** `from '@u7-scl/core`",
    '- **Корень:** `domain/src/**`',
    '- **Причина:** базовые классы в `core`.',
  ].join('\n');
  /** DEBT-5 — Место одной строкой (два glob и пояснение), без Корня. */
  const DEBT_5 = [
    '### DEBT-5: `v.isoDateTime` в схемах домена',
    '- **Место:** `domain/src/user/entity.ts`, `domain/src/course/*/entity.ts` (`createdAt`; `biome-ignore`)',
    '- **Признак:** `v\\.isoDateTime`',
  ].join('\n');
  const CLOSED = '### DEBT-6: слит в DEBT-1';
  const md = (...entries: string[]) =>
    ['# Реестр долга', '## 1. Группа', ...entries, '## 6. TR'].join('\n\n');

  const CODE = [
    file('domain/src/user/a.ts', CORE),
    file('domain/src/course/a.ts', CORE),
    file('domain/src/user/entity.ts', ISO),
    file('domain/src/course/lesson/entity.ts', ISO),
  ];
  const run = (
    code: readonly DomainFile[],
    debtMd = md(DEBT_1, DEBT_5, CLOSED),
    mode: 'transition' | 'strict' = 'strict',
  ) => checkDebt({ code, debtMd, mode });

  describe('разбор записи', () => {
    it('Место списком и строкой, Признак, Корень, закрытая — без нарушений', () => {
      expect(run(CODE)).toEqual([]);
    });

    it('открытая запись без Места — ошибка', () => {
      const debtMd = md(DEBT_1.replace(/- \*\*Место:\*\*\n( {2}- .*\n)+/, ''));
      expect(run(CODE.slice(0, 2), debtMd)).toEqual([
        'DEBT: DEBT-1: нет поля Место',
      ]);
    });

    it('открытая запись без Признака — ошибка', () => {
      const debtMd = md(DEBT_1.replace(/- \*\*Признак:\*\*.*\n/, ''));
      expect(run(CODE.slice(0, 2), debtMd)).toEqual([
        'DEBT: DEBT-1: нет поля Признак',
      ]);
    });

    it('Признак — неверная регулярка — ошибка', () => {
      const debtMd = md(DEBT_5.replace('`v\\.isoDateTime`', '`v(`'));
      expect(run(CODE.slice(2), debtMd)).toEqual([
        'DEBT: DEBT-5: Признак `v(` — неверная регулярка',
      ]);
    });

    it('Признак — регулярка с флагом m: ^ — начало строки', () => {
      const debtMd = md(
        [
          '### DEBT-10: приватные члены Ar',
          '- **Место:** `domain/src/course/a-root.ts`',
          '- **Признак:** `^\\s*(static\\s+)?#\\w+`',
        ].join('\n'),
      );
      const code = [
        file('domain/src/course/a-root.ts', 'class A {\n  static #x() {}\n}'),
      ];
      expect(run(code, debtMd)).toEqual([]);
    });

    it('шаблон записи в «Правилах» (DEBT-<n>) не считается записью', () => {
      const debtMd = md(
        '```\n### DEBT-<n>: <название>\n- **Место:** <glob>\n```',
        DEBT_5,
      );
      expect(run(CODE.slice(2), debtMd)).toEqual([]);
    });

    it('запись и поле внутри блока кода ``` не разбираются', () => {
      const example = [
        '```',
        '### DEBT-99: пример',
        '- **Место:** `nowhere/**`',
        '- **Признак:** `x`',
        '```',
      ].join('\n');
      const inEntry = `${DEBT_5}\n\`\`\`\n- **Место:** \`nowhere/**\`\n\`\`\``;
      expect(run(CODE.slice(2), md(example, inEntry))).toEqual([]);
    });

    it('пункт под другим полем, после пустой строки и вложенный — не Место', () => {
      const debtMd = md(
        [
          DEBT_1.replace(
            '- **Признак:**',
            '    - `nested()` — вложенное пояснение\n\n  - `bar()` — после пустой строки\n- **Признак:**',
          ),
          '  - `foo()` — после Причины',
        ].join('\n'),
      );
      expect(run(CODE.slice(0, 2), debtMd)).toEqual([]);
    });

    it('повторный заголовок записи — дубль', () => {
      expect(run(CODE.slice(2), md(DEBT_5, DEBT_5))).toEqual([
        'DEBT: DEBT-5: дубль записи',
      ]);
    });
  });

  describe('Место', () => {
    it('glob не находит ни одного файла — устаревшее место', () => {
      expect(run(CODE.slice(1, 2), md(DEBT_1))).toEqual([
        'DEBT: DEBT-1: Место `domain/src/user/**` не находит файлов — устаревшее место',
      ]);
    });

    it('признак пропал в одном glob слитой записи — долг погашен (glob)', () => {
      const code = [
        file('domain/src/user/a.ts', 'export {};'),
        ...CODE.slice(1),
      ];
      expect(run(code)).toEqual([
        'DEBT: DEBT-1: долг погашен (`domain/src/user/**`) — сними glob или закрой запись',
      ]);
    });

    it('признак есть хотя бы в одном файле glob — не погашен', () => {
      const code = [...CODE, file('domain/src/user/b.ts', 'export {};')];
      expect(run(code)).toEqual([]);
    });
  });

  describe('Корень', () => {
    it('признак в Корне вне Места — долг без записи (файл и строка)', () => {
      const code = [...CODE, file('domain/src/stream/a.ts', `// x\n${CORE}`)];
      expect(run(code)).toEqual([
        'DEBT: DEBT-1: долг без записи — domain/src/stream/a.ts:2',
      ]);
    });

    it('признак вне Корня — не ошибка', () => {
      const code = [...CODE, file('modules/stream/src/a.ts', CORE)];
      expect(run(code)).toEqual([]);
    });

    it('Корень не находит файлов — ошибка (поиск вне Места отключился бы)', () => {
      const debtMd = md(DEBT_1.replace('`domain/src/**`', '`nowhere/**`'));
      expect(run(CODE.slice(0, 2), debtMd)).toEqual([
        'DEBT: DEBT-1: Корень `nowhere/**` не находит файлов',
      ]);
    });

    it('Корень и Место с {…}: исключения перечислением, расширения', () => {
      const debtMd = md(
        [
          '### DEBT-40: тесты на временном каталоге',
          '- **Место:** `modules/wish/src/**/*.{uc,er,job}.test.ts`',
          '- **Признак:** `mkdtemp`',
          '- **Корень:** `{modules,platform}/*/src/**/*.{uc,er,job}.test.ts`',
        ].join('\n'),
      );
      const code = [
        file('modules/wish/src/wish/uc/a.uc.test.ts', 'mkdtemp'),
        file('modules/peer-review/src/b.er.test.ts', 'mkdtemp'),
        file('platform/core/src/c.job.test.ts', 'mkdtemp'),
        file('modules/peer-review/src/d.repo.test.ts', 'mkdtemp'),
        file('runners/u7-bot/src/e.uc.test.ts', 'mkdtemp'),
      ];
      expect(run(code, debtMd)).toEqual([
        'DEBT: DEBT-40: долг без записи — modules/peer-review/src/b.er.test.ts:1',
        'DEBT: DEBT-40: долг без записи — platform/core/src/c.job.test.ts:1',
      ]);
    });

    it('без Корня — ищется по всем файлам проверки', () => {
      const code = [...CODE, file('modules/user/src/b.ts', ISO)];
      expect(run(code)).toEqual([
        'DEBT: DEBT-5: долг без записи — modules/user/src/b.ts:2',
      ]);
    });

    it('ARC-02 без маркера: импорт app-legacy в домене вне Места — долг без записи', () => {
      const debtMd = md(
        [
          '### DEBT-2: импорт `@u7-scl/app-legacy` в домене',
          '- **Место:** `domain/src/user/module.ts`',
          "- **Признак:** `from '@u7-scl/app-legacy`",
          '- **Корень:** `domain/src/**`',
        ].join('\n'),
      );
      const code = [
        file('domain/src/user/module.ts', LEGACY),
        file('domain/src/course/module.ts', LEGACY),
      ];
      expect(run(code, debtMd)).toEqual([
        'DEBT: DEBT-2: долг без записи — domain/src/course/module.ts:1',
      ]);
    });
  });

  describe('DEBT-N в коде', () => {
    const bare = (text: string) => [
      ...CODE,
      file('modules/user/src/c.ts', text),
    ];

    it('голый маркер — ошибка в строгом режиме', () => {
      expect(run(bare('// DEBT-1\nexport {};'))).toEqual([
        'DEBT: modules/user/src/c.ts:1: DEBT-1 вне biome-ignore',
      ]);
    });

    it('упоминание в JSDoc — ошибка в строгом режиме', () => {
      expect(run(bare('/**\n * Вход; свести — DEBT-1.\n */'))).toEqual([
        'DEBT: modules/user/src/c.ts:2: DEBT-1 вне biome-ignore',
      ]);
    });

    it('голый маркер открытой записи — допустим в переходном режиме', () => {
      expect(
        run(bare('// DEBT-1\nexport {};'), undefined, 'transition'),
      ).toEqual([]);
    });

    it('голый маркер неизвестной записи — ошибка и в переходном режиме', () => {
      expect(
        run(bare('// DEBT-3\nexport {};'), undefined, 'transition'),
      ).toEqual([
        'DEBT: modules/user/src/c.ts:1: DEBT-3 — нет записи в debt.md',
      ]);
    });

    it('biome-ignore с ID открытой записи — без нарушений', () => {
      expect(run(bare('// biome-ignore lint/plugin: DEBT-5 — дата'))).toEqual(
        [],
      );
    });

    it('biome-ignore с неизвестным ID — ошибка', () => {
      expect(run(bare('// biome-ignore lint/plugin: DEBT-99 — x'))).toEqual([
        'DEBT: modules/user/src/c.ts:1: DEBT-99 — нет записи в debt.md',
      ]);
    });

    it('biome-ignore с закрытым ID — ошибка со ссылкой на запись слияния', () => {
      expect(run(bare('// biome-ignore lint/plugin: DEBT-6 — x'))).toEqual([
        'DEBT: modules/user/src/c.ts:1: DEBT-6 закрыт (слит в DEBT-1)',
      ]);
    });

    it('голый маркер закрытой записи в строгом режиме — ошибка «закрыт»', () => {
      expect(run(bare('// DEBT-6'))).toEqual([
        'DEBT: modules/user/src/c.ts:1: DEBT-6 закрыт (слит в DEBT-1)',
      ]);
    });

    it('старый формат D-<n> не считается маркером', () => {
      expect(run(bare('// D-1: причина'))).toEqual([]);
    });
  });
});

describe('checkDebt: маркеры временности вне Места открытой записи', () => {
  const DEBT = [
    '### DEBT-1: импорты `@u7-scl/core`',
    '- **Место:** `domain/src/user/**`',
    "- **Признак:** `from '@u7-scl/core`",
    '### DEBT-7: слит в DEBT-1',
    '- **Место:** `modules/old/**`',
    "- **Признак:** `from '@u7-scl/core`",
  ].join('\n\n');
  const CORE = "import { A } from '@u7-scl/core';";
  const run = (path: string, comment: string) =>
    checkDebt({
      code: [
        file('domain/src/user/a.ts', CORE),
        file(path, `${CORE}\n${comment}`),
      ],
      debtMd: DEBT,
      mode: 'strict',
    }).filter((e) => e.includes('маркер'));
  const err = (path: string, line: number, phrase: string) =>
    `DEBT: ${path}:${line}: маркер временности «${phrase}» вне Места открытой записи — заведи запись в debt.md или убери комментарий`;

  it.each([
    ['Временное решение', '// Временное решение: пока так'],
    ['ВРЕМЕННЫЙ', '/** ВРЕМЕННЫЙ адаптер */'],
    ['Уходит с миграцией', '// Уходит с миграцией модуля'],
  ])(
    '«%s» вне Места — ошибка с путём, строкой и подсказкой',
    (phrase, text) => {
      expect(run('modules/user/src/b.ts', text)).toEqual([
        err('modules/user/src/b.ts', 2, phrase),
      ]);
    },
  );

  it('фраза в файле из Места открытой записи — без ошибки', () => {
    expect(run('domain/src/user/b.ts', '// Временное решение')).toEqual([]);
  });

  it('фраза в Месте закрытой записи («слит в») — ошибка', () => {
    expect(run('modules/old/b.ts', '// Временное решение')).toEqual([
      err('modules/old/b.ts', 2, 'Временное решение'),
    ]);
  });

  it('«Временное решение» и «Уходит с миграцией» — без учёта регистра', () => {
    expect(run('modules/user/src/b.ts', '// временное РЕШЕНИЕ')).toHaveLength(
      1,
    );
    expect(run('modules/user/src/b.ts', '// уходит С миграцией')).toHaveLength(
      1,
    );
  });

  it('«ВРЕМЕННЫЙ» — только заглавными', () => {
    expect(run('modules/user/src/b.ts', '// временный адаптер')).toEqual([]);
  });

  it.each([
    '// временные метки',
    '// одновременно с этим',
    '// во временном каталоге',
  ])('без ложных срабатываний: %s', (text) => {
    expect(run('modules/user/src/b.ts', text)).toEqual([]);
  });
});

describe('checkTrMarkers: записи TR-<n> живут в debt.md, не в коде', () => {
  it('TR-<n> в комментарии, JSDoc и имени теста — ошибка с путём и строкой', () => {
    const code = [
      file('modules/user/src/a.ts', '// TR-11: адаптер\nconst x = 1;'),
      file('platform/app/src/b.ts', '/** Резолвер (D-50, TR-33). */'),
      file(
        'modules/course/src/c.test.ts',
        "describe('адаптер (TR-11)', () => {});",
      ),
    ];
    expect(checkTrMarkers(code)).toEqual([
      'TR: modules/user/src/a.ts:1: TR-11 — запись реестра в коде',
      'TR: platform/app/src/b.ts:1: TR-33 — запись реестра в коде',
      'TR: modules/course/src/c.test.ts:1: TR-11 — запись реестра в коде',
    ]);
  });

  it('код без TR-<n> и слова вроде STR-1 — без нарушений', () => {
    const code = [
      file(
        'modules/user/src/a.ts',
        "const id = 'STR-1'; // адаптер над legacy-фасадом",
      ),
    ];
    expect(checkTrMarkers(code)).toEqual([]);
  });
});
