/**
 * Тесты линт-правил архитектуры (rules.md: ARC, DOM, ERR, API, CODE).
 *
 * Фикстуры лежат в `lint-fixtures/` (расширение `.txt` — чтобы их не видели
 * biome и tsc) по путям, повторяющим реальные. Первая строка — ожидание:
 * `// expect: <ID> error|warning` или `// expect: none`. Тест копирует
 * фикстуры и настоящий `biome.json` во временный каталог (плагины — как из
 * установленного `dmg-core`) и запускает biome: сообщение должно начинаться
 * с ID правила. Правила на коде самого пакета — его тест
 * `scripts/lint-rules.test.ts` в репо `dmg-core`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { TempDir } from 'dmg-core/testing';

const ROOT = join(import.meta.dir, '..');
const FIXTURES = join(ROOT, 'lint-fixtures');
const BIOME = join(ROOT, 'node_modules/.bin/biome');

interface Diagnostic {
  severity: string;
  message: string;
  location?: { path?: string };
}

const fixtures = [...new Bun.Glob('**/*.txt').scanSync(FIXTURES)].map(
  (path) => {
    const first =
      readFileSync(join(FIXTURES, path), 'utf8').split('\n')[0] ?? '';
    const m = /^\/\/ expect: (?:none|(\S+) (error|warning))$/.exec(first);
    if (!m) throw new Error(`${path}: нет строки «// expect: …»`);
    return { target: path.replace(/\.txt$/, ''), id: m[1], severity: m[2] };
  },
);

const DMG_CORE = 'node_modules/dmg-core';

let tmp: TempDir;
let work: string;
let diagnostics: Diagnostic[];

/** Диагностики biome в `dir`; пути — от корня временного каталога. */
function lint(dir: string): Diagnostic[] {
  const run = Bun.spawnSync(
    [BIOME, 'lint', '--reporter=json', '--max-diagnostics=none', '.'],
    { cwd: dir },
  );
  return JSON.parse(run.stdout.toString()).diagnostics;
}

beforeAll(() => {
  tmp = TempDir.create('lint-rules-');
  work = tmp.path;
  const config = JSON.parse(readFileSync(join(ROOT, 'biome.json'), 'utf8'));
  config.vcs = undefined;
  writeFileSync(join(work, 'biome.json'), JSON.stringify(config));
  // Плагины корень берёт из установленного пакета (node_modules/dmg-core);
  // правила самого пакета проверяет его тест (dmg-core/scripts/lint-rules).
  cpSync(
    join(ROOT, DMG_CORE, 'biome-plugins'),
    join(work, 'node_modules/dmg-core/biome-plugins'),
    { recursive: true },
  );
  for (const f of fixtures) {
    const to = join(work, f.target);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(join(FIXTURES, `${f.target}.txt`), to);
  }
  diagnostics = lint(work);
});

afterAll(() => tmp.dispose());

const ruleDiagnostics = (target: string) =>
  diagnostics.filter(
    (d) =>
      d.location?.path === target &&
      /^(ARC|DOM|ERR|API|CODE)-\d+:/.test(d.message),
  );

describe('линт-правила архитектуры', () => {
  for (const f of fixtures) {
    test(`${f.target}: ${f.id ?? 'нет нарушений'}`, () => {
      const found = ruleDiagnostics(f.target);
      if (f.id === undefined) {
        expect(found.map((d) => d.message)).toEqual([]);
        return;
      }
      const hit = found.find((d) => d.message.startsWith(`${f.id}:`));
      expect(hit?.severity).toBe(f.severity);
    });
  }
});
