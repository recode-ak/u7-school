import { afterEach, beforeEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GenLayout } from './layout';
import { runGen } from './main';

let root: string;
let out: string[];
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gen-main-'));
  out = [];
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const gen = (...argv: string[]) =>
  runGen(
    argv,
    new GenLayout({ domain: 'd/{m}', app: 'p/{m}/src' }, root),
    (line) => out.push(line),
  );

test('первая строка вывода — применяемая раскладка', () => {
  gen('module', 'stream');
  expect(out[0]).toStartWith('Раскладка: домен — d/{m}');
});

test('dry-run по умолчанию: печатает план и ничего не пишет', () => {
  expect(gen('module', 'stream')).toBe(0);
  expect(existsSync(join(root, 'd'))).toBe(false);
  expect(out.join('\n')).toContain('stream.module.ts');
  expect(out.join('\n')).toContain('--write');
});

test('module --write создаёт домен и прикладной слой', () => {
  expect(gen('module', 'stream', '--write')).toBe(0);
  expect(existsSync(join(root, 'd/stream/stream.module.ts'))).toBe(true);
  expect(existsSync(join(root, 'p/stream/src/stream.module.ts'))).toBe(true);
});

test('aggregate --write: домен и прикладной слой, правки модулей применены', () => {
  gen('module', 'stream', '--write');
  expect(gen('aggregate', 'stream.student', '--write')).toBe(0);
  expect(existsSync(join(root, 'd/stream/student/student.ar.ts'))).toBe(true);
  expect(
    existsSync(join(root, 'p/stream/src/infra/student.json-repo.ts')),
  ).toBe(true);
  expect(
    readFileSync(join(root, 'd/stream/stream.module.ts'), 'utf8'),
  ).toContain('StudentArDef,');
  expect(
    readFileSync(join(root, 'p/stream/src/stream.module.ts'), 'utf8'),
  ).toContain('readonly studentRepo');
});

test('uc/er/job/dcs/dqs --write', () => {
  gen('module', 'stream', '--write');
  gen('aggregate', 'stream.student', '--write');
  expect(gen('uc', 'stream.student', 'complete-student', '--write')).toBe(0);
  expect(gen('er', 'stream.student', 'react-student', '--write')).toBe(0);
  expect(gen('job', 'stream.student', 'sweep-students', '--write')).toBe(0);
  expect(gen('dcs', 'stream', 'progress', '--write')).toBe(0);
  expect(gen('dqs', 'stream', 'navigation', '--write')).toBe(0);
  expect(
    existsSync(join(root, 'p/stream/src/student/uc/complete-student.uc.ts')),
  ).toBe(true);
  expect(existsSync(join(root, 'd/stream/navigation.dqs.ts'))).toBe(true);
});

/** Раскладка с корнем сборки `src/app` (как у single). */
const WIRED = { domain: 'd/{m}', app: 'p/{m}/src', compositionRoot: 'src/app' };
const genWired = (...argv: string[]) =>
  runGen(argv, new GenLayout(WIRED, root), (line) => out.push(line));

test('module без каркаса: «Вставь вручную» с точными путями app.ts и arch-check.ts', () => {
  expect(genWired('module', 'stream', '--write')).toBe(0);
  const text = out.join('\n');
  expect(text).toContain(
    `Вставь вручную в ${join(root, 'src/app/app.ts')} перед // gen:modules:`,
  );
  expect(text).toContain('createStreamModule({');
  expect(text).toContain(
    `Вставь вручную в ${join(root, 'scripts/arch-check.ts')} перед // gen:modules:`,
  );
});

test('своя раскладка без gen.compositionRoot: общая подсказка, ложных путей нет', () => {
  expect(gen('module', 'stream', '--write')).toBe(0);
  const text = out.join('\n');
  expect(text).toContain('Корень сборки не задан (gen.compositionRoot');
  expect(text).not.toContain('src/app/app.ts');
});

/** Корень сборки и arch-check.ts с маркерами — как после `dmg-core init`. */
function wiringFiles(app: string): void {
  mkdirSync(join(root, app), { recursive: true });
  writeFileSync(
    join(root, app, 'app.ts'),
    [
      "import { join } from 'node:path';",
      '// gen:imports',
      '',
      'export const make = (env: { dataDir: string }) => [',
      '  join(env.dataDir),',
      '  // gen:modules',
      '];',
      '',
    ].join('\n'),
  );
  mkdirSync(join(root, 'scripts'));
  writeFileSync(
    join(root, 'scripts/arch-check.ts'),
    "import { join } from 'node:path';\n// gen:imports\nconst modules = [\n  // gen:modules\n];\n",
  );
}

test('module и aggregate по маркерам: фабрика с репозиторием, Def в arch-check', () => {
  wiringFiles('src/app');
  genWired('module', 'stream', '--write');
  genWired('aggregate', 'stream.student', '--write');
  expect(out.join('\n')).not.toContain('Вставь вручную');
  const app = readFileSync(join(root, 'src/app/app.ts'), 'utf8');
  expect(app).toContain(
    "import { createStreamModule, StudentJsonRepo } from '../../p/stream/src';",
  );
  expect(app).toContain(
    "import { StreamModuleDef } from '../../d/stream/contract';",
  );
  expect(app).toContain(
    "studentRepo: new StudentJsonRepo(\n              join(env.dataDir, 'stream.student.json'),\n            ),\n            // gen:repos:stream",
  );
  expect(readFileSync(join(root, 'scripts/arch-check.ts'), 'utf8')).toContain(
    '  StreamModuleDef,\n  // gen:modules',
  );
});

test('агрегат task в двух модулях: у каждого свой репозиторий и файл данных', () => {
  wiringFiles('src/app');
  for (const m of ['alpha', 'beta']) {
    genWired('module', m, '--write');
  }
  out = [];
  genWired('aggregate', 'alpha.task', '--write');
  genWired('aggregate', 'beta.task', '--write');
  const app = readFileSync(join(root, 'src/app/app.ts'), 'utf8');
  expect(app).toContain(
    "taskRepo: new TaskJsonRepo(join(env.dataDir, 'alpha.task.json')),\n            // gen:repos:alpha",
  );
  // Второй TaskJsonRepo — конфликт имени: импорт и строка — вручную.
  expect(app.match(/TaskJsonRepo/g)?.length).toBe(2);
  const text = out.join('\n');
  expect(text).toContain(
    "имя TaskJsonRepo уже импортировано из '../../p/alpha/src' — нужен алиас",
  );
  expect(text).toContain(
    `Вставь вручную в ${join(root, 'src/app/app.ts')} перед // gen:repos:beta`,
  );
  expect(text).toContain("join(env.dataDir, 'beta.task.json')");
});

test('dry-run: уже объявленная зависимость не печатается как «Будет изменён»', () => {
  mkdirSync(join(root, 'app'));
  writeFileSync(
    join(root, 'app/package.json'),
    '{ "dependencies": { "@acme/stream": "workspace:*" } }',
  );
  const layout = new GenLayout(
    { ...PACKAGE_LAYOUT, compositionRoot: 'app/src' },
    root,
  );
  runGen(['module', 'stream'], layout, (l) => out.push(l), DEPS);
  expect(out.join('\n')).not.toContain('app/package.json');
});

test('module: вход прикладного слоя index.ts; aggregate дописывает репозиторий', () => {
  gen('module', 'stream', '--write');
  gen('aggregate', 'stream.student', '--write');
  expect(readFileSync(join(root, 'p/stream/src/index.ts'), 'utf8')).toContain(
    [
      "export { StudentJsonRepo } from './infra/student.json-repo';",
      "export { createStreamModule, type StreamDeps } from './stream.module';",
      "export type { StudentRepo } from './student/student.repo';",
      '// gen:exports',
    ].join('\n'),
  );
});

const PACKAGE_LAYOUT = {
  domain: 'd/{m}',
  app: 'p/{m}/src',
  domainImport: '@acme/d/{m}',
  package: '@acme/{m}',
};
const DEPS = { 'dmg-core': '^2.0.0', valibot: '^1.5.0' };
const genPackage = (...argv: string[]) =>
  runGen(argv, new GenLayout(PACKAGE_LAYOUT, root), (l) => out.push(l), DEPS);

test('module с gen.package: нет package.json корня сборки — подсказка с путём', () => {
  const layout = new GenLayout(
    { ...PACKAGE_LAYOUT, compositionRoot: 'app/src' },
    root,
  );
  runGen(['module', 'stream', '--write'], layout, (l) => out.push(l), DEPS);
  expect(out.join('\n')).toContain(
    `Вставь вручную в ${join(root, 'app/package.json')}, dependencies: "@acme/stream": "workspace:*"`,
  );
  expect(out.join('\n')).toContain('bun install');
});

test('module с gen.package: зависимость вписана в package.json корня сборки', () => {
  mkdirSync(join(root, 'app'));
  writeFileSync(join(root, 'app/package.json'), '{ "name": "@acme/app" }');
  const layout = new GenLayout(
    { ...PACKAGE_LAYOUT, compositionRoot: 'app/src' },
    root,
  );
  runGen(['module', 'stream', '--write'], layout, (l) => out.push(l), DEPS);
  expect(out).toContain(`Изменён: ${join(root, 'app/package.json')}`);
  expect(
    JSON.parse(readFileSync(join(root, 'app/package.json'), 'utf8')),
  ).toEqual({
    name: '@acme/app',
    dependencies: { '@acme/stream': 'workspace:*' },
  });
});

test('module с gen.package: пакет модуля с версиями зависимостей из вызова', () => {
  expect(genPackage('module', 'stream', '--write')).toBe(0);
  expect(
    JSON.parse(readFileSync(join(root, 'p/stream/package.json'), 'utf8'))
      .dependencies,
  ).toEqual({ ...DEPS, '@acme/d': 'workspace:*' });
  expect(existsSync(join(root, 'p/stream/tsconfig.json'))).toBe(true);
});

test('module --adopt с gen.package: package.json и tsconfig.json пакета не тронуты', () => {
  mkdirSync(join(root, 'p/wish/src'), { recursive: true });
  writeFileSync(join(root, 'p/wish/package.json'), '{}');
  writeFileSync(join(root, 'p/wish/tsconfig.json'), '{ }');
  expect(genPackage('module', 'wish', '--adopt', '--write')).toBe(0);
  expect(readFileSync(join(root, 'p/wish/package.json'), 'utf8')).toBe('{}');
  expect(readFileSync(join(root, 'p/wish/tsconfig.json'), 'utf8')).toBe('{ }');
  expect(existsSync(join(root, 'p/wish/src/wish.module.ts'))).toBe(true);
  const text = out.join('\n');
  expect(text).toContain(`Пропущен: ${join(root, 'p/wish/package.json')}`);
  expect(text).toContain(`Пропущен: ${join(root, 'p/wish/tsconfig.json')}`);
});

test('module с gen.package без --adopt: существующий package.json — коллизия', () => {
  mkdirSync(join(root, 'p/wish'), { recursive: true });
  writeFileSync(join(root, 'p/wish/package.json'), '{}');
  expect(genPackage('module', 'wish', '--write')).toBe(1);
  expect(existsSync(join(root, 'd/wish'))).toBe(false);
});

test('module --adopt: legacy без входа прикладного слоя — index.ts создан с маркером', () => {
  mkdirSync(join(root, 'd/wish'), { recursive: true });
  mkdirSync(join(root, 'p/wish/src'), { recursive: true });
  writeFileSync(join(root, 'd/wish/index.ts'), '// legacy\n');
  expect(gen('module', 'wish', '--adopt', '--write')).toBe(0);
  const index = readFileSync(join(root, 'p/wish/src/index.ts'), 'utf8');
  expect(index).toContain(
    "export { createWishModule, type WishDeps } from './wish.module';",
  );
  expect(index).toContain('// gen:exports');
  expect(out.join('\n')).toContain(
    `Создан: ${join(root, 'p/wish/src/index.ts')}`,
  );
});

test('ошибка ввода: код 1 и сообщение, ничего не создано', () => {
  expect(gen('uc', 'stream.student', 'x')).toBe(1);
  expect(out.join('\n')).toContain('Модуль «stream» не найден');
});

test('коллизия: код 1, ничего не записано второй раз', () => {
  gen('module', 'stream', '--write');
  out = [];
  expect(gen('module', 'stream', '--write')).toBe(1);
  expect(out.join('\n')).toContain('уже существует');
});

test('нет маркера: печатает строку для ручной вставки, код 0', () => {
  gen('module', 'stream', '--write');
  const modulePath = join(root, 'd/stream/stream.module.ts');
  Bun.write(modulePath, 'export {};\n');
  out = [];
  expect(gen('aggregate', 'stream.student', '--write')).toBe(0);
  expect(out.join('\n')).toContain('Вставь вручную');
  expect(out.join('\n')).toContain('StudentArDef');
});

const snapshot = (dir: string) =>
  Object.fromEntries(
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => statSync(join(dir, f)).isFile())
      .sort()
      .map((f) => [f, readFileSync(join(dir, f), 'utf8')]),
  );

const slice = [
  ['module', 'stream'],
  ['aggregate', 'stream.student'],
  ['uc', 'stream.student', 'complete-student'],
  ['er', 'stream.student', 'react-student'],
  ['job', 'stream.student', 'sweep-students'],
  ['dcs', 'stream', 'progress'],
  ['dqs', 'stream', 'navigation'],
];

test('детерминизм: два прогона среза дают побайтно одинаковые деревья', () => {
  for (const step of slice) gen(...step, '--write');
  const first = snapshot(root);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root);
  for (const step of slice) gen(...step, '--write');
  expect(snapshot(root)).toEqual(first);
});

test('повтор команды не меняет файлы: код 1 и дерево прежнее', () => {
  for (const step of slice) gen(...step, '--write');
  const before = snapshot(root);
  for (const step of slice) expect(gen(...step, '--write')).toBe(1);
  expect(snapshot(root)).toEqual(before);
});

test('module --adopt поверх legacy: точки входа не тронуты, паспорт создан', () => {
  mkdirSync(join(root, 'd/wish'), { recursive: true });
  mkdirSync(join(root, 'p/wish/src'), { recursive: true });
  writeFileSync(join(root, 'd/wish/index.ts'), '// legacy\n');
  writeFileSync(join(root, 'p/wish/src/index.ts'), '// legacy app\n');
  writeFileSync(join(root, 'p/wish/package.json'), '{}');
  expect(gen('module', 'wish', '--adopt', '--write')).toBe(0);
  expect(existsSync(join(root, 'd/wish/wish.module.ts'))).toBe(true);
  expect(existsSync(join(root, 'p/wish/src/wish.module.ts'))).toBe(true);
  expect(readFileSync(join(root, 'd/wish/index.ts'), 'utf8')).toBe(
    '// legacy\n',
  );
  expect(readFileSync(join(root, 'p/wish/package.json'), 'utf8')).toBe('{}');
  expect(readFileSync(join(root, 'p/wish/src/index.ts'), 'utf8')).toBe(
    '// legacy app\n',
  );
  expect(out.join('\n')).toContain(
    `Пропущен: ${join(root, 'd/wish/index.ts')}`,
  );
});
