import { afterEach, beforeEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPlan } from './apply';
import { GenError } from './cli';

let dir: string;
const p = (rel: string) => join(dir, rel);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gen-apply-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('dry-run ничего не пишет, но сообщает, что было бы записано', () => {
  const r = applyPlan(
    { files: [{ path: p('a/b.ts'), content: 'x' }], edits: [] },
    { write: false },
  );
  expect(r.written).toEqual([p('a/b.ts')]);
  expect(existsSync(p('a'))).toBe(false);
});

test('write создаёт каталоги и файлы', () => {
  applyPlan(
    { files: [{ path: p('a/b.ts'), content: 'x' }], edits: [] },
    { write: true },
  );
  expect(readFileSync(p('a/b.ts'), 'utf8')).toBe('x');
});

test('коллизия: ошибка перечисляет все занятые файлы, ничего не записано', () => {
  writeFileSync(p('old.ts'), 'old');
  writeFileSync(p('old2.ts'), 'old2');
  const plan = {
    files: [
      { path: p('new.ts'), content: 'n' },
      { path: p('old.ts'), content: 'x' },
      { path: p('old2.ts'), content: 'x' },
    ],
    edits: [],
  };
  for (const write of [true, false]) {
    let err: unknown;
    try {
      applyPlan(plan, { write });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GenError);
    expect((err as Error).message).toContain(p('old.ts'));
    expect((err as Error).message).toContain(p('old2.ts'));
  }
  expect(existsSync(p('new.ts'))).toBe(false);
  expect(readFileSync(p('old.ts'), 'utf8')).toBe('old');
});

test('дубль пути внутри плана — ошибка', () => {
  expect(() =>
    applyPlan(
      {
        files: [
          { path: p('a.ts'), content: '1' },
          { path: p('a.ts'), content: '2' },
        ],
        edits: [],
      },
      { write: true },
    ),
  ).toThrow(GenError);
  expect(existsSync(p('a.ts'))).toBe(false);
});

test('правка по маркеру: строка вставляется перед маркером, маркер остаётся', () => {
  writeFileSync(p('index.ts'), "export * from './a.ts';\n// gen:exports\n");
  const edit = {
    path: p('index.ts'),
    marker: '// gen:exports',
    line: "export * from './b.ts';",
  };
  const r = applyPlan({ files: [], edits: [edit] }, { write: true });
  expect(r.edited).toEqual([p('index.ts')]);
  expect(readFileSync(p('index.ts'), 'utf8')).toBe(
    "export * from './a.ts';\nexport * from './b.ts';\n// gen:exports\n",
  );
});

test('правка идемпотентна: уже вставленная строка не дублируется', () => {
  writeFileSync(p('index.ts'), "export * from './b.ts';\n// gen:exports\n");
  const edit = {
    path: p('index.ts'),
    marker: '// gen:exports',
    line: "export * from './b.ts';",
  };
  const r = applyPlan({ files: [], edits: [edit] }, { write: true });
  expect(r.edited).toEqual([]);
  expect(r.hints).toEqual([]);
});

test('нет маркера или файла: hint для ручной вставки, без падения', () => {
  writeFileSync(p('index.ts'), 'export {};\n');
  const noMarker = {
    path: p('index.ts'),
    marker: '// gen:exports',
    line: 'L1',
  };
  const noFile = { path: p('none.ts'), marker: '// gen:defs', line: 'L2' };
  const r = applyPlan(
    { files: [], edits: [noMarker, noFile] },
    { write: true },
  );
  expect(r.hints).toEqual([noMarker, noFile]);
  expect(readFileSync(p('index.ts'), 'utf8')).toBe('export {};\n');
});

test('несколько правок одного файла накапливаются в порядке плана', () => {
  writeFileSync(p('index.ts'), '// gen:exports\n');
  const mk = (line: string) => ({
    path: p('index.ts'),
    marker: '// gen:exports',
    line,
  });
  applyPlan({ files: [], edits: [mk('A'), mk('B')] }, { write: true });
  expect(readFileSync(p('index.ts'), 'utf8')).toBe('A\nB\n// gen:exports\n');
});

test('dry-run не меняет файл с маркером', () => {
  writeFileSync(p('index.ts'), '// gen:exports\n');
  const r = applyPlan(
    {
      files: [],
      edits: [{ path: p('index.ts'), marker: '// gen:exports', line: 'A' }],
    },
    { write: false },
  );
  expect(r.edited).toEqual([p('index.ts')]);
  expect(readFileSync(p('index.ts'), 'utf8')).toBe('// gen:exports\n');
});

test('строки import/export вставляются в порядке путей источника (как biome)', () => {
  writeFileSync(
    p('index.ts'),
    [
      "export { A } from './a/a';",
      "export { T } from './t/t';",
      '// gen:exports',
      '',
    ].join('\n'),
  );
  const mk = (line: string) => ({
    path: p('index.ts'),
    marker: '// gen:exports',
    line,
  });
  applyPlan(
    {
      files: [],
      edits: [
        mk("export { P } from './p';"),
        mk("export { Z } from './z/z';"),
        mk("export { B } from '../b';"),
      ],
    },
    { write: true },
  );
  expect(readFileSync(p('index.ts'), 'utf8')).toBe(
    [
      "export { B } from '../b';",
      "export { A } from './a/a';",
      "export { P } from './p';",
      "export { T } from './t/t';",
      "export { Z } from './z/z';",
      '// gen:exports',
      '',
    ].join('\n'),
  );
});

test('импорты: пакет раньше относительных; блок отделён комментарием выше', () => {
  writeFileSync(
    p('m.ts'),
    [
      "import { d } from 'dmg-core';",
      "import { f } from './f';",
      '// gen:defs:imports',
      '',
    ].join('\n'),
  );
  const edit = (line: string) => ({
    path: p('m.ts'),
    marker: '// gen:defs:imports',
    line,
  });
  applyPlan(
    {
      files: [],
      edits: [
        edit("import { a } from './a/a';"),
        edit("import { v } from 'valibot';"),
      ],
    },
    { write: true },
  );
  expect(readFileSync(p('m.ts'), 'utf8')).toBe(
    [
      "import { d } from 'dmg-core';",
      "import { v } from 'valibot';",
      "import { a } from './a/a';",
      "import { f } from './f';",
      '// gen:defs:imports',
      '',
    ].join('\n'),
  );
});

test('порядок путей: точка раньше дефиса, как у biome', () => {
  writeFileSync(p('i.ts'), "export { F } from './s.facade';\n// gen:exports\n");
  applyPlan(
    {
      files: [],
      edits: [
        {
          path: p('i.ts'),
          marker: '// gen:exports',
          line: "export { N } from './s-nav.dqs';",
        },
        {
          path: p('i.ts'),
          marker: '// gen:exports',
          line: "export { M } from './s.module';",
        },
      ],
    },
    { write: true },
  );
  expect(readFileSync(p('i.ts'), 'utf8')).toBe(
    "export { F } from './s.facade';\nexport { M } from './s.module';\nexport { N } from './s-nav.dqs';\n// gen:exports\n",
  );
});

test('adopt: существующий index.ts пропускается, правки идут в него', () => {
  writeFileSync(p('index.ts'), '// legacy\n// gen:exports\n');
  const r = applyPlan(
    {
      files: [
        { path: p('index.ts'), content: 'new' },
        { path: p('m.module.ts'), content: 'm' },
      ],
      edits: [
        {
          path: p('index.ts'),
          marker: '// gen:exports',
          line: "export * from './a';",
        },
      ],
    },
    { write: true, adopt: true },
  );
  expect(r.skipped.map((f) => f.path)).toEqual([p('index.ts')]);
  expect(r.written).toEqual([p('m.module.ts')]);
  expect(readFileSync(p('index.ts'), 'utf8')).toBe(
    "// legacy\nexport * from './a';\n// gen:exports\n",
  );
});

test('adopt: существующий contract.ts пропускается (D-45)', () => {
  writeFileSync(p('contract.ts'), '// legacy\n');
  const r = applyPlan(
    {
      files: [
        { path: p('contract.ts'), content: 'new' },
        { path: p('m.module.ts'), content: 'm' },
      ],
      edits: [],
    },
    { write: true, adopt: true },
  );
  expect(r.skipped.map((f) => f.path)).toEqual([p('contract.ts')]);
  expect(readFileSync(p('contract.ts'), 'utf8')).toBe('// legacy\n');
});

test('adopt: коллизия остальных файлов — по-прежнему ошибка', () => {
  writeFileSync(p('m.module.ts'), 'old');
  writeFileSync(p('package.json'), '{}');
  expect(() =>
    applyPlan(
      {
        files: [
          { path: p('m.module.ts'), content: 'x' },
          { path: p('package.json'), content: 'x' },
        ],
        edits: [],
      },
      { write: true, adopt: true },
    ),
  ).toThrow(GenError);
});

/** Правка по маркеру `// gen:imports` файла `rel`. */
const atImports = (rel: string, line: string) => ({
  path: p(rel),
  marker: '// gen:imports',
  line,
});

test('импорт из того же источника сливается с существующим (как biome)', () => {
  writeFileSync(
    p('app.ts'),
    [
      "import { join } from 'node:path';",
      "import { createTodoModule } from '@acme/todo';",
      '// gen:imports',
      '',
    ].join('\n'),
  );
  const edit = atImports(
    'app.ts',
    "import { TaskJsonRepo } from '@acme/todo';",
  );
  const r = applyPlan({ files: [], edits: [edit] }, { write: true });
  expect(r.edited).toEqual([p('app.ts')]);
  const merged = [
    "import { join } from 'node:path';",
    "import { createTodoModule, TaskJsonRepo } from '@acme/todo';",
    '// gen:imports',
    '',
  ].join('\n');
  expect(readFileSync(p('app.ts'), 'utf8')).toBe(merged);

  // Повтор: имя уже в импорте — файл не меняется.
  const again = applyPlan({ files: [], edits: [edit] }, { write: true });
  expect(again.edited).toEqual([]);
  expect(again.hints).toEqual([]);
  expect(readFileSync(p('app.ts'), 'utf8')).toBe(merged);
});

test('слитый импорт длиннее строки форматтера — по имени на строку', () => {
  writeFileSync(
    p('app.ts'),
    "import { createLongModuleNameModule } from '@acme/long-module-name';\n// gen:imports\n",
  );
  applyPlan(
    {
      files: [],
      edits: [
        atImports(
          'app.ts',
          "import { AggregateJsonRepo } from '@acme/long-module-name';",
        ),
      ],
    },
    { write: true },
  );
  expect(readFileSync(p('app.ts'), 'utf8')).toBe(
    [
      'import {',
      '  AggregateJsonRepo,',
      '  createLongModuleNameModule,',
      "} from '@acme/long-module-name';",
      '// gen:imports',
      '',
    ].join('\n'),
  );
});

test('импорт типов и значений из одного источника не сливаются', () => {
  writeFileSync(
    p('app.ts'),
    "import type { A } from '@acme/a';\n// gen:imports\n",
  );
  applyPlan(
    { files: [], edits: [atImports('app.ts', "import { b } from '@acme/a';")] },
    { write: true },
  );
  expect(readFileSync(p('app.ts'), 'utf8')).toBe(
    "import type { A } from '@acme/a';\nimport { b } from '@acme/a';\n// gen:imports\n",
  );
});

test('многострочный импорт в блоке: вставка по порядку источников', () => {
  writeFileSync(
    p('app.ts'),
    [
      "import { join } from 'node:path';",
      'import {',
      '  ApiApp,',
      '  type AppContext,',
      "} from 'dmg-core/app';",
      "import type { AppEnv } from './app.types';",
      '// gen:imports',
      '',
    ].join('\n'),
  );
  applyPlan(
    {
      files: [],
      edits: [
        atImports('app.ts', "import { createTodoModule } from '@acme/todo';"),
        atImports('app.ts', "import { ApiError } from 'dmg-core/app';"),
      ],
    },
    { write: true },
  );
  expect(readFileSync(p('app.ts'), 'utf8')).toBe(
    [
      "import { join } from 'node:path';",
      "import { createTodoModule } from '@acme/todo';",
      // Слитый импорт укладывается в строку — biome собирает его в одну.
      "import { ApiApp, ApiError, type AppContext } from 'dmg-core/app';",
      "import type { AppEnv } from './app.types';",
      '// gen:imports',
      '',
    ].join('\n'),
  );
});

test('многострочная вставка: перед маркером, повтор не дублирует', () => {
  writeFileSync(p('app.ts'), 'const m = [\n  // gen:modules\n];\n');
  const edit = {
    path: p('app.ts'),
    marker: '// gen:modules',
    line: '  {\n    def: A,\n  },',
  };
  applyPlan({ files: [], edits: [edit] }, { write: true });
  const once = 'const m = [\n  {\n    def: A,\n  },\n  // gen:modules\n];\n';
  expect(readFileSync(p('app.ts'), 'utf8')).toBe(once);
  const again = applyPlan({ files: [], edits: [edit] }, { write: true });
  expect(again.edited).toEqual([]);
  expect(readFileSync(p('app.ts'), 'utf8')).toBe(once);
});

test('зависимость в package.json: правка JSON, остальное сохранено', () => {
  writeFileSync(
    p('package.json'),
    `${JSON.stringify(
      { name: '@acme/app', dependencies: { '@acme/domain': 'workspace:*' } },
      null,
      2,
    )}\n`,
  );
  const dep = {
    path: p('package.json'),
    name: '@acme/todo',
    version: 'workspace:*',
  };
  const dry = applyPlan(
    { files: [], edits: [], dependencies: [dep] },
    { write: false },
  );
  expect(dry.edited).toEqual([p('package.json')]);
  expect(JSON.parse(readFileSync(p('package.json'), 'utf8'))).toEqual({
    name: '@acme/app',
    dependencies: { '@acme/domain': 'workspace:*' },
  });

  const r = applyPlan(
    { files: [], edits: [], dependencies: [dep] },
    { write: true },
  );
  expect(r.edited).toEqual([p('package.json')]);
  expect(readFileSync(p('package.json'), 'utf8')).toBe(
    `${JSON.stringify(
      {
        name: '@acme/app',
        dependencies: {
          '@acme/domain': 'workspace:*',
          '@acme/todo': 'workspace:*',
        },
      },
      null,
      2,
    )}\n`,
  );

  const again = applyPlan(
    { files: [], edits: [], dependencies: [dep] },
    { write: true },
  );
  expect(again.edited).toEqual([]);
  expect(again.dependencyHints).toEqual([]);
});

test('зависимость: нет package.json — подсказка для ручной вставки', () => {
  const dep = {
    path: p('app/package.json'),
    name: '@acme/todo',
    version: 'workspace:*',
  };
  const r = applyPlan(
    { files: [], edits: [], dependencies: [dep] },
    { write: true },
  );
  expect(r.dependencyHints).toEqual([dep]);
  expect(r.edited).toEqual([]);
  expect(existsSync(p('app/package.json'))).toBe(false);
});

test('присутствие строки — только в своём блоке над маркером, не во всём файле', () => {
  const repo = "    taskRepo: new TaskJsonRepo(join(dir, 'x')),";
  writeFileSync(
    p('app.ts'),
    [
      'const modules = [',
      '  a({',
      repo,
      '    // gen:repos:a',
      '  }),',
      '  b({',
      '    ...deps,',
      '    // gen:repos:b',
      '  }),',
      '];',
      '',
    ].join('\n'),
  );
  const r = applyPlan(
    {
      files: [],
      edits: [{ path: p('app.ts'), marker: '// gen:repos:b', line: repo }],
    },
    { write: true },
  );
  expect(r.edited).toEqual([p('app.ts')]);
  expect(readFileSync(p('app.ts'), 'utf8')).toContain(
    `    ...deps,\n${repo}\n    // gen:repos:b`,
  );
});

test('конфликт имени импорта: правка и её группа — «Вставь вручную» с причиной', () => {
  const app = [
    "import { TaskJsonRepo } from '@acme/a';",
    '// gen:imports',
    'const modules = [',
    '  b({',
    '    // gen:repos:b',
    '  }),',
    '];',
    '',
  ].join('\n');
  writeFileSync(p('app.ts'), app);
  const imp = {
    path: p('app.ts'),
    marker: '// gen:imports',
    line: "import { TaskJsonRepo } from '@acme/b';",
    group: 'repo:b.task',
  };
  const repo = {
    path: p('app.ts'),
    marker: '// gen:repos:b',
    line: '    taskRepo: new TaskJsonRepo(),',
    group: 'repo:b.task',
  };
  const r = applyPlan({ files: [], edits: [imp, repo] }, { write: true });
  expect(r.edited).toEqual([]);
  expect(readFileSync(p('app.ts'), 'utf8')).toBe(app);
  expect(r.hints).toEqual([
    {
      ...imp,
      reason: "имя TaskJsonRepo уже импортировано из '@acme/a' — нужен алиас",
    },
    { ...repo, reason: 'не вставлена связанная правка группы repo:b.task' },
  ]);
});

test('зависимость уже объявлена: package.json не меняется и не в edited', () => {
  const text = '{\n  "dependencies": { "@acme/todo": "workspace:*" }\n}\n';
  writeFileSync(p('package.json'), text);
  const dep = {
    path: p('package.json'),
    name: '@acme/todo',
    version: 'workspace:*',
  };
  for (const write of [false, true]) {
    const r = applyPlan(
      { files: [], edits: [], dependencies: [dep] },
      { write },
    );
    expect(r.edited).toEqual([]);
    expect(r.dependencyHints).toEqual([]);
  }
  expect(readFileSync(p('package.json'), 'utf8')).toBe(text);
});

test('битый package.json — GenError с путём, ничего не записано', () => {
  writeFileSync(p('package.json'), '{ "name": ');
  writeFileSync(p('index.ts'), '// gen:exports\n');
  const plan = {
    files: [],
    edits: [{ path: p('index.ts'), marker: '// gen:exports', line: 'A' }],
    dependencies: [
      { path: p('package.json'), name: '@acme/todo', version: 'workspace:*' },
    ],
  };
  expect(() => applyPlan(plan, { write: true })).toThrow(GenError);
  expect(() => applyPlan(plan, { write: true })).toThrow(p('package.json'));
  expect(readFileSync(p('index.ts'), 'utf8')).toBe('// gen:exports\n');
});
