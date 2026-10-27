import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PackageSource } from './package-source';

// Версии зависимостей пакета — из его package.json: по ним каркас проекта
// (`init --profile`) пишет зависимости потребителя.

const PACKAGE_ROOT = join(import.meta.dir, '../..');

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'package-source-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('PackageSource: версии зависимостей', () => {
  it('peer и dev — как в package.json пакета', async () => {
    const manifest = JSON.parse(
      await readFile(join(PACKAGE_ROOT, 'package.json'), 'utf8'),
    );

    const pkg = await PackageSource.load(PACKAGE_ROOT);

    expect(pkg.version).toBe(manifest.version);
    expect(pkg.peerDependencies).toEqual(manifest.peerDependencies);
    expect(pkg.devDependencies).toEqual(manifest.devDependencies);
    expect(pkg.peerDependencies.valibot).toBeString();
    expect(pkg.devDependencies['@biomejs/biome']).toBeString();
  });

  it('нет секций зависимостей — пустые словари', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'dmg-core', version: '1.0.0' }),
    );
    await mkdir(join(dir, 'skills'));
    await mkdir(join(dir, 'agents/roles'), { recursive: true });

    const pkg = await PackageSource.load(dir);

    expect(pkg.peerDependencies).toEqual({});
    expect(pkg.devDependencies).toEqual({});
  });
});
