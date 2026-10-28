import { describe, expect, it } from 'bun:test';
import { win32 } from 'node:path';
import { GenError } from '../../gen/cli';
import { ProjectManifest } from './project-manifest';

// Существующий package.json проекта: имя и слияние с package.json каркаса.

const SCAFFOLD = {
  name: 'acme',
  private: true,
  type: 'module',
  workspaces: ['domain', 'app'],
  scripts: { check: 'bun test', lint: 'biome check .' },
  dependencies: { 'dmg-core': '^0.1.0', valibot: '^1.5.0' },
  devDependencies: { typescript: '^5.9.0' },
};

const text = (data: object) => `${JSON.stringify(data, null, 2)}\n`;
const merge = (existing: object, scaffold: object = SCAFFOLD) =>
  JSON.parse(
    ProjectManifest.parse(text(existing)).merge(text(scaffold)) ?? 'null',
  );

describe('ProjectManifest: разбор и имя', () => {
  it('имя — поле name; нет поля — undefined', () => {
    expect(ProjectManifest.parse(text({ name: 'acme' })).name()).toBe('acme');
    expect(ProjectManifest.parse(text({})).name()).toBeUndefined();
    expect(ProjectManifest.parse(text({ name: 1 })).name()).toBeUndefined();
  });

  it('не JSON или не объект — GenError', () => {
    expect(() => ProjectManifest.parse('{')).toThrow(GenError);
    expect(() => ProjectManifest.parse('[1]')).toThrow(GenError);
  });
});

describe('ProjectManifest: слияние', () => {
  it('пустой файл — всё из каркаса, формат biome (отступ 2, перевод строки)', () => {
    const merged = ProjectManifest.parse('{}').merge(text(SCAFFOLD));
    expect(merged).toBe(text(SCAFFOLD));
  });

  it('поля проекта сохраняются, отсутствующие добавляются', () => {
    const result = merge({
      name: 'acme',
      version: '0.0.1',
      scripts: { start: 'bun src/runner/main.ts' },
    });
    expect(result.version).toBe('0.0.1');
    expect(result.scripts).toEqual({
      start: 'bun src/runner/main.ts',
      check: 'bun test',
      lint: 'biome check .',
    });
    expect(result.workspaces).toEqual(['domain', 'app']);
    expect(Object.keys(result)[0]).toBe('name');
  });

  it('совпадающие значения — не конфликт; добавлять нечего — undefined', () => {
    const compact = ProjectManifest.parse(JSON.stringify(SCAFFOLD));
    expect(compact.merge(text(SCAFFOLD))).toBeUndefined();
  });

  it('все зависимости секции уже есть в других — пустая секция не добавляется', () => {
    const result = merge(
      { dependencies: { 'dmg-core': '^0.1.0' } },
      { devDependencies: { 'dmg-core': '^0.1.0' }, private: true },
    );
    expect(result).toEqual({
      dependencies: { 'dmg-core': '^0.1.0' },
      private: true,
    });
  });

  it('зависимость: версия проекта выигрывает', () => {
    const result = merge({ dependencies: { 'dmg-core': '^0.2.0' } });
    expect(result.dependencies).toEqual({
      'dmg-core': '^0.2.0',
      valibot: '^1.5.0',
    });
  });

  it('зависимость в другой секции — остаётся, не дублируется', () => {
    const result = merge(
      { dependencies: { 'dmg-core': '^0.1.0' } },
      { devDependencies: { 'dmg-core': '^0.1.0', typescript: '^5.9.0' } },
    );
    expect(result.dependencies).toEqual({ 'dmg-core': '^0.1.0' });
    expect(result.devDependencies).toEqual({ typescript: '^5.9.0' });
  });

  it('конфликт значений — GenError со всеми ключами', () => {
    const existing = ProjectManifest.parse(
      text({
        name: 'other',
        type: 'commonjs',
        workspaces: ['libs/*'],
        scripts: { check: 'npm test' },
      }),
    );
    let error: unknown;
    try {
      existing.merge(text(SCAFFOLD));
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GenError);
    const message = (error as GenError).message;
    for (const key of ['name', 'type', 'workspaces', 'scripts.check']) {
      expect(message).toContain(`«${key}»`);
    }
    expect(message).toContain('ничего не записано');
  });

  it('секция зависимостей не объект — конфликт', () => {
    expect(() => merge({ dependencies: 'dmg-core' })).toThrow('«dependencies»');
  });
});

describe('ProjectManifest: спецификатор не из реестра', () => {
  const spec = (version: string, section = 'dependencies') =>
    ProjectManifest.parse(
      text({ [section]: { 'dmg-core': version } }),
    ).localSpec('dmg-core');

  it('tarball, file:, link:, путь, git, url — спецификатор как есть', () => {
    for (const version of [
      './dmg-core-0.1.0.tgz',
      'dmg-core-0.1.0.tgz',
      'file:../dmg-core-0.1.0.tgz',
      'file:../dmg-core',
      'link:dmg-core',
      '../dmg-core',
      '/opt/dmg-core',
      'github:acme/dmg-core',
      'acme/dmg-core',
      'https://example.com/dmg-core-0.1.0.tgz',
    ])
      expect(spec(version)).toBe(version);
  });

  it('диапазон или тег реестра — undefined', () => {
    for (const version of ['^0.1.0', '0.1.0', '~0.1', '>=0.1 <1', 'latest'])
      expect(spec(version)).toBeUndefined();
  });

  it('ищется во всех секциях зависимостей; нет зависимости — undefined', () => {
    expect(spec('./dmg-core.tgz', 'devDependencies')).toBe('./dmg-core.tgz');
    expect(ProjectManifest.parse('{}').localSpec('dmg-core')).toBeUndefined();
  });
});

describe('ProjectManifest.portable', () => {
  it('абсолютный путь — от корня проекта; относительный и реестр — как есть', () => {
    expect(ProjectManifest.portable('/w/v/d.tgz', '/w/p')).toBe('../v/d.tgz');
    expect(ProjectManifest.portable('/w/p/d.tgz', '/w/p')).toBe('./d.tgz');
    expect(ProjectManifest.portable('file:/w/d.tgz', '/w/p')).toBe(
      'file:../d.tgz',
    );
    expect(ProjectManifest.portable('../d.tgz', '/w/p')).toBe('../d.tgz');
    expect(ProjectManifest.portable('^0.1.0', '/w/p')).toBe('^0.1.0');
  });

  it('пустой спецификатор — как есть', () => {
    expect(ProjectManifest.portable('', '/w/p')).toBe('');
  });

  it('относительного пути нет (другой диск) — исходный спецификатор', () => {
    expect(ProjectManifest.portable('D:\\v\\d.tgz', 'C:\\p', win32)).toBe(
      'D:\\v\\d.tgz',
    );
    expect(ProjectManifest.portable('C:\\v\\d.tgz', 'C:\\p', win32)).toBe(
      '../v/d.tgz',
    );
  });
});
