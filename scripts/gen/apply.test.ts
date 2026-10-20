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
import { applyPlan } from './apply.ts';
import { GenError } from './cli.ts';

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
