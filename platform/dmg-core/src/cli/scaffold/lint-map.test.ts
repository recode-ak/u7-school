import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LintMap } from './lint-map';

// Целостность таблицы. Срабатывание каждой строки на своих каталогах —
// в project-scaffold.e2e.test.ts (biome на временном каркасе).

const PLUGINS_DIR = join(import.meta.dir, '../../../biome-plugins');

for (const [profile, map] of [
  ['single', LintMap.single],
  ['monorepo', LintMap.monorepo],
] as const) {
  describe(`LintMap.${profile}`, () => {
    it('подключает каждый плагин пакета', () => {
      const plugins = map.rules.flatMap((rule) =>
        'plugin' in rule ? [`${rule.plugin}.grit`] : [],
      );

      expect(plugins.sort()).toEqual(readdirSync(PLUGINS_DIR).sort());
    });
  });
}

describe('LintMap: repeats', () => {
  it('ссылка на строку без запрета импортов — исключение', () => {
    const map = new LintMap([
      { id: 'DOM-14', plugin: 'dom-14-no-clock', includes: ['src/**'] },
      {
        id: 'DOM-01',
        includes: ['src/**'],
        imports: [{ group: ['**/state'], message: 'DOM-01: …' }],
        repeats: ['DOM-14'],
      },
    ]);

    expect(() => map.overrides()).toThrow(
      'Карта линтера: DOM-01 повторяет DOM-14 — нет строки с запретом импортов',
    );
  });
});

// Раздел «Карта линтера» в rules.md пишется по LintMap: каждая строка
// таблицы (ID и плагин) названа в нём.
describe('LintMap: карта в rules.md', () => {
  const rules = readFileSync(
    join(import.meta.dir, '../../../docs/rules.md'),
    'utf8',
  );
  const map = rules.split('## Карта линтера')[1]?.split('\n## ')[0] ?? '';

  it('называет ID и плагин каждой строки', () => {
    const missing = LintMap.single.rules
      .flatMap((rule) =>
        'plugin' in rule ? [rule.id, `${rule.plugin}.grit`] : [rule.id],
      )
      .filter((name) => !map.includes(name));

    expect(missing).toEqual([]);
  });
});
