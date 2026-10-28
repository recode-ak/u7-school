import { describe, expect, it } from 'bun:test';
import { GenError } from './cli';
import { PackageManifest } from './package-manifest';

const parse = (json: object) =>
  PackageManifest.parse('/p/package.json', JSON.stringify(json));

describe('PackageManifest', () => {
  it('добавляет зависимость и пишет текст в форме каркаса', () => {
    const text = parse({ name: 'x' }).withDependency('@a/b', 'workspace:*');
    expect(text).toBe(
      `${JSON.stringify({ name: 'x', dependencies: { '@a/b': 'workspace:*' } }, null, 2)}\n`,
    );
  });

  it('уже объявленная зависимость — без изменений (undefined)', () => {
    const manifest = parse({ dependencies: { '@a/b': '^1.0.0' } });
    expect(manifest.withDependency('@a/b', 'workspace:*')).toBeUndefined();
  });

  it('битый JSON — GenError с путём', () => {
    const run = () => PackageManifest.parse('/p/package.json', '{ oops');
    expect(run).toThrow(GenError);
    expect(run).toThrow('/p/package.json: не разобран JSON');
  });

  it('остальные поля и существующие зависимости сохраняются', () => {
    const manifest = parse({
      name: 'x',
      scripts: { test: 'bun test' },
      dependencies: { valibot: '^1.0.0' },
      devDependencies: { typescript: '^5' },
    });
    const next = JSON.parse(manifest.withDependency('@a/b', 'w') ?? '{}');
    expect(next).toEqual({
      name: 'x',
      scripts: { test: 'bun test' },
      dependencies: { valibot: '^1.0.0', '@a/b': 'w' },
      devDependencies: { typescript: '^5' },
    });
  });
});
