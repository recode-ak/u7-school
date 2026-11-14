import { describe, expect, it } from 'bun:test';
import { lstatSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Страж раскладки монорепо по осям (трек repo-layout): каталогов
 * `packages/` и `apps/` нет, ссылок на них — тоже. История, данные и
 * внешний контент не проверяются (`SKIP_DIRS`).
 */
const ROOT = join(import.meta.dir, '..');

/**
 * Ссылка на старый каталог: `packages/…` или `apps/…` не внутри другого
 * имени, либо последний сегмент пути в строке (`'../packages'`)
 */
const OLD_PATH = /(^|[^A-Za-z0-9_.-])(packages|apps)\/|\/(packages|apps)['"`]/;

/**
 * Не проверяются: история (архив треков, CHANGELOG),
 * данные и внешний контент (скачанные уроки, шаблоны conductor-setup).
 */
const SKIP_DIRS = [
  'conductor/archive/',
  'CHANGELOG.md',
  'data/',
  'authoring/w3school/output/',
  '.pi/skills/conductor-setup/templates/',
];

/** Исключения с причиной: сам страж называет старые каталоги. */
const EXCEPTIONS = ['scripts/repo-layout.test.ts'];

function trackedFiles(): string[] {
  const out = Bun.spawnSync(['git', 'ls-files', '-z'], { cwd: ROOT });
  return out.stdout.toString().split('\0').filter(Boolean);
}

/** Обычный файл: удалённые из рабочего дерева и симлинки не читаются */
function isFile(path: string): boolean {
  return lstatSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

describe('раскладка монорепо', () => {
  it('нет каталогов packages/ и apps/', () => {
    expect(lstatSync(join(ROOT, 'packages'), { throwIfNoEntry: false })).toBe(
      undefined,
    );
    expect(lstatSync(join(ROOT, 'apps'), { throwIfNoEntry: false })).toBe(
      undefined,
    );
  });

  it('нет файлов по старым путям (фикстуры повторяют раскладку)', () => {
    const offenders = trackedFiles().filter(
      (file) =>
        !SKIP_DIRS.some((dir) => file.startsWith(dir)) && OLD_PATH.test(file),
    );
    expect(offenders).toEqual([]);
  });

  it('нет ссылок на packages/ и apps/ в коде, конфигах и документах', async () => {
    const offenders: string[] = [];
    for (const file of trackedFiles()) {
      if (SKIP_DIRS.some((dir) => file.startsWith(dir))) continue;
      if (EXCEPTIONS.includes(file)) continue;
      const path = join(ROOT, file);
      if (!isFile(path)) continue;
      const lines = (await Bun.file(path).text()).split('\n');
      lines.forEach((line, i) => {
        if (OLD_PATH.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
