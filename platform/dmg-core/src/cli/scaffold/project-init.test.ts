import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { GenError } from '../../gen/cli';
import { PackageSource } from '../package-source';
import { ProjectInit } from './project-init';
import { ProjectScaffold } from './project-scaffold';
import type { InitOptions } from './project-scaffold.types';

// Каркас в каталог проекта: имя проекта, dry-run, запись без перезаписи,
// слияние существующего package.json.

const PACKAGE_ROOT = join(import.meta.dir, '../../..');

let pkg: PackageSource;
let work: string;
let root: string;

beforeAll(async () => {
  pkg = await PackageSource.load(PACKAGE_ROOT);
});

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), 'project-init-'));
  root = join(work, 'my-school');
  await mkdir(root);
});

afterEach(() => rm(work, { recursive: true, force: true }));

const run = (options: Partial<InitOptions> = {}) =>
  new ProjectInit(pkg).run(root, {
    profile: 'single',
    dryRun: false,
    ...options,
  });

const read = (path: string) => readFile(join(root, path), 'utf8');

async function put(path: string, text: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), text);
}

const text = (data: object) => `${JSON.stringify(data, null, 2)}\n`;

async function snapshot(): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for await (const path of new Bun.Glob('**/*').scan({ cwd: root, dot: true }))
    files.set(path, await read(path));
  return files;
}

async function failure(options: Partial<InitOptions> = {}): Promise<string> {
  const error = await run(options).then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(GenError);
  return (error as GenError).message;
}

describe('ProjectInit: имя проекта', () => {
  it('--name важнее package.json: другое name в файле — конфликт', async () => {
    const lines = await run({ name: 'from-flag', dryRun: true });
    expect(lines[0]).toBe('Каркас single: from-flag');
    await put('package.json', '{ "name": "from-file" }\n');
    const message = await failure({ name: 'from-flag', dryRun: true });
    expect(message).toContain('«name»');
  });

  it('нет --name — name из package.json', async () => {
    await put('package.json', '{ "name": "from-file" }\n');
    const lines = await run({ dryRun: true });
    expect(lines[0]).toBe('Каркас single: from-file');
  });

  it('нет ни того, ни другого — имя каталога', async () => {
    const lines = await run({ profile: 'monorepo', dryRun: true });
    expect(lines[0]).toBe('Каркас monorepo: my-school');
  });

  it('неверное имя — GenError', async () => {
    expect(await failure({ name: 'My School' })).toContain('My School');
  });
});

describe('ProjectInit: dry-run', () => {
  it('план с путями от корня, ничего не записано', async () => {
    const lines = await run({ dryRun: true });
    expect(lines).toContain('Будет создан: src/app/app.ts');
    expect(lines).toContain('Будет создан: package.json');
    expect(lines.at(-1)).toContain('dry-run');
    expect((await snapshot()).size).toBe(0);
  });

  it('коллизия видна и в dry-run', async () => {
    await put('dmg-core.json', '{}\n');
    expect(await failure({ dryRun: true })).toContain('dmg-core.json');
  });
});

describe('ProjectInit: запись', () => {
  it('пишет план, пути в выводе — от корня', async () => {
    const lines = await run({ name: 'acme' });
    expect(lines[0]).toBe('Каркас single: acme');
    expect(lines).toContain('Создан: src/runner/main.ts');
    expect(JSON.parse(await read('package.json')).name).toBe('acme');
    expect(await read('src/app/app.ts')).toContain('class App');
  });

  it('коллизия (dmg-core.json) — GenError, каталог как до запуска', async () => {
    await put('dmg-core.json', '{}\n');
    await put('package.json', '{ "name": "acme" }\n');
    const before = await snapshot();
    expect(await failure()).toContain('dmg-core.json');
    expect(await snapshot()).toEqual(before);
  });
});

describe('ProjectInit: существующий package.json', () => {
  it('после bun add dmg-core — слит, зависимость не дублируется', async () => {
    await put(
      'package.json',
      '{\n  "dependencies": {\n    "dmg-core": "^0.0.9"\n  }\n}\n',
    );
    const lines = await run({ profile: 'monorepo' });
    expect(lines).toContain('Дополнен: package.json');
    expect(lines).not.toContain('Создан: package.json');
    const manifest = JSON.parse(await read('package.json'));
    expect(manifest.name).toBe('my-school');
    expect(manifest.workspaces).toEqual([
      'domain',
      'app',
      'modules/*',
      'runners/*',
    ]);
    expect(manifest.dependencies).toEqual({ 'dmg-core': '^0.0.9' });
    expect(manifest.devDependencies['dmg-core']).toBeUndefined();
    expect(manifest.devDependencies.typescript).toBeDefined();
    expect(manifest.scripts.check).toContain('arch:check');
  });

  it('monorepo, dmg-core не из реестра — overrides с тем же спецификатором', async () => {
    const tarball = 'file:../dmg-core-0.1.0.tgz';
    await put('package.json', text({ dependencies: { 'dmg-core': tarball } }));
    await run({ profile: 'monorepo' });
    const manifest = JSON.parse(await read('package.json'));
    expect(manifest.overrides).toEqual({ 'dmg-core': tarball });
    expect(manifest.dependencies).toEqual({ 'dmg-core': tarball });
  });

  it('monorepo, dmg-core из реестра — overrides нет', async () => {
    await put('package.json', text({ dependencies: { 'dmg-core': '^0.1.0' } }));
    await run({ profile: 'monorepo' });
    expect(JSON.parse(await read('package.json')).overrides).toBeUndefined();
  });

  it('single, dmg-core не из реестра — overrides нет (пакетов нет)', async () => {
    await put(
      'package.json',
      text({ dependencies: { 'dmg-core': './d.tgz' } }),
    );
    await run({ profile: 'single' });
    expect(JSON.parse(await read('package.json')).overrides).toBeUndefined();
  });

  it('overrides.dmg-core с другим значением — конфликт, каталог как до запуска', async () => {
    await put(
      'package.json',
      text({
        dependencies: { 'dmg-core': './dmg-core-0.1.0.tgz' },
        overrides: { 'dmg-core': '^0.1.0' },
      }),
    );
    const before = await snapshot();
    expect(await failure({ profile: 'monorepo' })).toContain(
      '«overrides.dmg-core»',
    );
    expect(await snapshot()).toEqual(before);
  });

  it('добавлять нечего — файл не по формату biome не переписан', async () => {
    const scaffold = new ProjectScaffold({
      profile: 'single',
      name: 'acme',
      pkg,
    })
      .plan()
      .files.find((f) => f.path === 'package.json');
    const compact = JSON.stringify(JSON.parse(scaffold?.content ?? '{}'));
    await put('package.json', compact);
    for (const dryRun of [true, false]) {
      const lines = await run({ dryRun });
      expect(lines.some((line) => line.includes('package.json'))).toBe(false);
      expect(await read('package.json')).toBe(compact);
    }
  });

  it('dry-run со слиянием — «Будет дополнен», файл не тронут', async () => {
    await put('package.json', '{}\n');
    const lines = await run({ dryRun: true });
    expect(lines).toContain('Будет дополнен: package.json');
    expect(await read('package.json')).toBe('{}\n');
  });

  it('конфликт значения — GenError, каталог как до запуска', async () => {
    await put('package.json', '{ "name": "acme", "type": "commonjs" }\n');
    const before = await snapshot();
    expect(await failure()).toContain('«type»');
    expect(await snapshot()).toEqual(before);
  });
});
