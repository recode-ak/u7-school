/**
 * Тесты линт-правил архитектуры (rules.md: ARC, DOM, ERR, API, CODE).
 *
 * Фикстуры лежат в `lint-fixtures/` (расширение `.txt` — чтобы их не видели
 * biome и tsc) по путям, повторяющим реальные. Первая строка — ожидание:
 * `// expect: <ID> error|warning` или `// expect: none`. Тест копирует
 * фикстуры и настоящий `biome.json` с плагинами во временный каталог и
 * запускает biome: сообщение должно начинаться с ID правила.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const FIXTURES = join(ROOT, 'lint-fixtures');
const BIOME = join(ROOT, 'node_modules/.bin/biome');

type Config = Record<string, unknown>;

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

const DMG_CORE = 'packages/dmg-core';

let work: string;
let diagnostics: Diagnostic[];

/** Скопировать конфиг пакета или корня (и плагины, если есть) в `dir`. */
function copyConfig(from: string, dir: string, patch: (c: Config) => void) {
  const config = JSON.parse(readFileSync(join(from, 'biome.json'), 'utf8'));
  config.vcs = undefined;
  patch(config);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'biome.json'), JSON.stringify(config));
  if (existsSync(join(from, 'biome-plugins'))) {
    cpSync(join(from, 'biome-plugins'), join(dir, 'biome-plugins'), {
      recursive: true,
    });
  }
}

/** Диагностики biome в `dir`; пути — от корня временного каталога. */
function lint(dir: string, prefix: string): Diagnostic[] {
  const run = Bun.spawnSync(
    [BIOME, 'lint', '--reporter=json', '--max-diagnostics=none', '.'],
    { cwd: dir },
  );
  const found: Diagnostic[] = JSON.parse(run.stdout.toString()).diagnostics;
  return found.map((d) => ({
    ...d,
    location: { path: `${prefix}${d.location?.path ?? ''}` },
  }));
}

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'lint-rules-'));
  // Корень линтует всё, кроме dmg-core, как настоящий biome.json.
  copyConfig(ROOT, work, () => {});
  // dmg-core — самостоятельный пакет: его фикстуры проверяет конфиг пакета.
  copyConfig(join(ROOT, DMG_CORE), join(work, DMG_CORE), () => {});
  for (const f of fixtures) {
    const to = join(work, f.target);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(join(FIXTURES, `${f.target}.txt`), to);
  }
  diagnostics = [
    ...lint(work, ''),
    ...lint(join(work, DMG_CORE), `${DMG_CORE}/`),
  ];
});

afterAll(() => rmSync(work, { recursive: true, force: true }));

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
