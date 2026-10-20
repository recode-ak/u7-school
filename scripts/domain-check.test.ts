import { describe, expect, it } from 'bun:test';
import {
  checkDebt,
  checkDomainGraph,
  checkDomainImports,
  type DomainFile,
} from './domain-check';

const DEPENDS = { user: [], course: ['user'], stream: ['course'] };

const file = (path: string, text: string): DomainFile => ({ path, text });

describe('checkDomainImports: ARC-04 / ARC-06', () => {
  it('импорт модуля из dependsOn через index — без нарушений', () => {
    const files = [
      file(
        'packages/domain/src/course/a.ts',
        "import { U } from '../user';\nimport { V } from '@u7-scl/domain/user';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });

  it('импорт модуля вне dependsOn — ARC-04', () => {
    const files = [
      file('packages/domain/src/user/a.ts', "import { C } from '../course';"),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-04: packages/domain/src/user/a.ts: модуль user не зависит от course (import '../course')",
    ]);
  });

  it('импорт внутренностей чужого модуля — ARC-04', () => {
    const files = [
      file(
        'packages/domain/src/course/a.ts',
        "import { U } from '../user/state';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-04: packages/domain/src/course/a.ts: чужой модуль user только через index (import '../user/state')",
    ]);
  });

  it('подпути @u7-scl/domain/<m>/state и /contract разрешены публичными', () => {
    const files = [
      file(
        'packages/domain/src/course/a.ts',
        "import { U } from '@u7-scl/domain/user/contract';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });

  it('импорт прикладного пакета модуля — ARC-06', () => {
    const files = [
      file(
        'packages/domain/src/user/a.ts',
        "import { X } from '@u7-scl/user';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-06: packages/domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/user')",
    ]);
  });

  it('импорт ui / infra / apps — ARC-06', () => {
    const files = [
      file(
        'packages/domain/src/user/a.ts',
        "import { X } from '../../../user/src/infra/repo';\nimport { B } from '@u7-scl/bot';\nimport { Y } from '@u7-scl/cli';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-06: packages/domain/src/user/a.ts: домен не импортирует прикладной слой (import '../../../user/src/infra/repo')",
      "ARC-06: packages/domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/bot')",
      "ARC-06: packages/domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/cli')",
    ]);
  });

  it('app/core без маркера DEBT — ARC-02', () => {
    const files = [
      file(
        'packages/domain/src/user/a.ts',
        "import { A } from '@u7-scl/app';\nimport { C } from '@u7-scl/core';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([
      "ARC-02: packages/domain/src/user/a.ts: импорт '@u7-scl/app' без // DEBT-<n>",
      "ARC-02: packages/domain/src/user/a.ts: импорт '@u7-scl/core' без // DEBT-<n>",
    ]);
  });

  it('app/core с маркером DEBT в той же строке или строкой выше — ок', () => {
    const files = [
      file(
        'packages/domain/src/user/a.ts',
        "import { A } from '@u7-scl/app'; // DEBT-1\n// DEBT-2\nimport { C } from '@u7-scl/core';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toEqual([]);
  });

  it('многострочный import и export from разбираются', () => {
    const files = [
      file(
        'packages/domain/src/user/a.ts',
        "import {\n  A,\n  B,\n} from '../course';\nexport * from '../stream';",
      ),
    ];
    expect(checkDomainImports(files, DEPENDS)).toHaveLength(2);
  });

  it('файлы вне packages/domain/src/<m>/ игнорируются', () => {
    const files = [file('packages/user/src/a.ts', "import '@u7-scl/app';")];
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

describe('checkDebt: сверка маркеров в коде и debt.md', () => {
  const md = (...ids: string[]) => ids.map((id) => `### ${id}: x\n`).join('\n');
  const at = (id: string) => [
    file('packages/domain/src/user/a.ts', `// ${id}: причина`),
  ];

  it('всё согласовано — без нарушений', () => {
    const code = [
      file('packages/domain/src/user/a.ts', '// DEBT-1'),
      file('packages/user/src/domain/index.ts', '// DEBT-2 — barrel'),
    ];
    expect(checkDebt({ code, debtMd: md('DEBT-1', 'DEBT-2') })).toEqual([]);
  });

  it('маркер в коде без записи в debt.md', () => {
    expect(checkDebt({ code: at('DEBT-3'), debtMd: md() })).toEqual([
      'DEBT: DEBT-3 есть в коде (packages/domain/src/user/a.ts), но нет записи в debt.md',
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
