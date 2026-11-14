import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ArchChecker } from 'dmg-core/arch';
import { TempDir } from 'dmg-core/testing';
import { DomainArch } from './domain-arch';

const ROOT = join(import.meta.dir, '..');

describe('DomainArch.layout', () => {
  it('раскладка проекта: домен — domain/src, прикладной слой — modules', () => {
    expect(DomainArch.layout('wish')).toEqual({
      domain: join(ROOT, 'domain/src/wish'),
      app: join(ROOT, 'modules/wish/src'),
    });
  });
});

describe('DomainArch: корень сборки и раннеры (D-52)', () => {
  it('корень сборки — platform/app/src', () => {
    expect(DomainArch.root).toBe(join(ROOT, 'platform/app/src'));
  });

  it('раннеры — src каждого runners/*', () => {
    expect(DomainArch.runners).toEqual([join(ROOT, 'runners/u7-bot/src')]);
  });

  describe('фикстура: раннер импортирует прикладной пакет', () => {
    let tmp: TempDir;
    let runner: string;

    beforeAll(async () => {
      tmp = TempDir.create('domain-arch-runner-');
      runner = tmp.path;
      await writeFile(
        join(runner, 'main.ts'),
        `import { WishJsonRepo } from '${join(ROOT, 'modules/wish/src/index')}';\n`,
      );
    });

    afterAll(async () => {
      tmp.dispose();
    });

    it('ARC-08', () => {
      const report = ArchChecker.of({ ...DomainArch, runners: [runner] })
        .report()
        .filter((line) => line.startsWith('ARC-08'));
      expect(report).toEqual([
        expect.stringContaining('импортирует прикладной пакет wish'),
      ]);
    });
  });
});
