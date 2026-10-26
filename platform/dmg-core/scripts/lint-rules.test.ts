/**
 * Тесты lint-правил пакета (rules.md: ARC, DOM, ERR, API, CODE) на его
 * собственном коде.
 *
 * Фикстуры лежат в `lint-fixtures/` (расширение `.txt` — чтобы их не видели
 * biome и tsc) по путям, повторяющим `src/`. Первая строка — ожидание:
 * `// expect: <ID> error|warning` или `// expect: none`. Тест копирует
 * фикстуры, `biome.json` и плагины пакета во временный каталог и запускает
 * biome: сообщение должно начинаться с ID правила.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const PKG = join(import.meta.dir, '..');
const FIXTURES = join(PKG, 'lint-fixtures');
const BIOME = Bun.resolveSync('@biomejs/biome/bin/biome', PKG);

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

let work: string;
let diagnostics: Diagnostic[];

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'dmg-lint-rules-'));
  const config = JSON.parse(readFileSync(join(PKG, 'biome.json'), 'utf8'));
  config.vcs = undefined;
  writeFileSync(join(work, 'biome.json'), JSON.stringify(config));
  cpSync(join(PKG, 'biome-plugins'), join(work, 'biome-plugins'), {
    recursive: true,
  });
  for (const f of fixtures) {
    const to = join(work, f.target);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(join(FIXTURES, `${f.target}.txt`), to);
  }
  const run = Bun.spawnSync(
    [BIOME, 'lint', '--reporter=json', '--max-diagnostics=none', '.'],
    { cwd: work },
  );
  diagnostics = JSON.parse(run.stdout.toString()).diagnostics;
});

afterAll(() => rmSync(work, { recursive: true, force: true }));

const ruleDiagnostics = (target: string) =>
  diagnostics.filter(
    (d) =>
      d.location?.path === target &&
      /^(ARC|DOM|ERR|API|CODE)-\d+:/.test(d.message),
  );

/** Группы ARC-10 в `biome.json` пакета (белый список импортов) */
function arc10Groups(): string[][] {
  const config = JSON.parse(readFileSync(join(PKG, 'biome.json'), 'utf8'));
  const groups: string[][] = [];
  for (const o of config.overrides ?? []) {
    const patterns =
      o.linter?.rules?.style?.noRestrictedImports?.options?.patterns ?? [];
    for (const p of patterns) {
      if (p.message.startsWith('ARC-10:')) groups.push(p.group);
    }
  }
  return groups;
}

test('ARC-10: белый список разрешает каждую peer-зависимость пакета', () => {
  const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
  const peers = Object.keys(pkg.peerDependencies ?? {});
  const groups = arc10Groups();
  expect(groups.length).toBeGreaterThan(0);
  for (const group of groups) {
    for (const peer of peers) expect(group).toContain(`!${peer}`);
  }
});

describe('lint-правила пакета', () => {
  test('фикстуры есть', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

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
