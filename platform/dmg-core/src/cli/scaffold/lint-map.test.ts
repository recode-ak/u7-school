import { describe, expect, it } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LintMap } from './lint-map';

// Целостность таблицы. Срабатывание каждой строки на своих каталогах —
// в project-scaffold.e2e.test.ts (biome на временном каркасе).

const PLUGINS_DIR = join(import.meta.dir, '../../../biome-plugins');

describe('LintMap.single', () => {
  it('подключает каждый плагин пакета', () => {
    const plugins = LintMap.single.rules.flatMap((rule) =>
      'plugin' in rule ? [`${rule.plugin}.grit`] : [],
    );

    expect(plugins.sort()).toEqual(readdirSync(PLUGINS_DIR).sort());
  });
});

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
