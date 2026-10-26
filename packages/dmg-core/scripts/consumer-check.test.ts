import { describe, expect, it } from 'bun:test';
import { checkDelivered, PLUGINS, REQUIRED } from './consumer-check';

const EXISTING = new Set([
  'node_modules/dmg-core/llms.txt',
  'node_modules/dmg-core/docs',
  'node_modules/dmg-core/docs/rules.md',
]);
const exists = (path: string) => EXISTING.has(path);
const file = (
  text: string,
  path = '.claude/skills/dmg-architecture/SKILL.md',
) => ({
  path,
  text,
});

describe('checkDelivered: пути пакета в доставленных копиях', () => {
  it('существующие пути (файл и каталог) — без нарушений', () => {
    expect(
      checkDelivered(
        [
          file(
            'Вход — `node_modules/dmg-core/docs/` и `node_modules/dmg-core/llms.txt`.\n' +
              'Правила: node_modules/dmg-core/docs/rules.md.',
          ),
        ],
        exists,
      ),
    ).toEqual([]);
  });

  it('несуществующий путь — нарушение с файлом копии', () => {
    expect(
      checkDelivered(
        [file('См. `node_modules/dmg-core/docs/gone.md`', 'AGENTS.md')],
        exists,
      ),
    ).toEqual(['AGENTS.md: нет node_modules/dmg-core/docs/gone.md']);
  });

  it('шаблоны с <…> и * не проверяются', () => {
    expect(
      checkDelivered(
        [
          file(
            '`node_modules/dmg-core/docs/guides/<вид>.md`, node_modules/dmg-core/src/*',
          ),
        ],
        exists,
      ),
    ).toEqual([]);
  });
});

it('REQUIRED: init доставляет конфиг, скил и вставку; пакет несёт индекс и правила', () => {
  expect(REQUIRED).toEqual([
    'dmg-core.json',
    'AGENTS.md',
    '.claude/skills/dmg-architecture/SKILL.md',
    'node_modules/dmg-core/llms.txt',
    'node_modules/dmg-core/README.md',
    'node_modules/dmg-core/docs/index.md',
    'node_modules/dmg-core/docs/rules.md',
  ]);
});

it('PLUGINS: все GritQL-плагины пакета — в установленном пакете', () => {
  expect(PLUGINS).toEqual([
    'node_modules/dmg-core/biome-plugins/api-02-no-manual-publish.grit',
    'node_modules/dmg-core/biome-plugins/arc-09-no-env.grit',
    'node_modules/dmg-core/biome-plugins/code-02-class-members.grit',
    'node_modules/dmg-core/biome-plugins/dom-11-base-fields.grit',
    'node_modules/dmg-core/biome-plugins/dom-12-no-iso-dates.grit',
    'node_modules/dmg-core/biome-plugins/dom-14-no-clock.grit',
    'node_modules/dmg-core/biome-plugins/dom-17-snapshot-repo-only.grit',
    'node_modules/dmg-core/biome-plugins/err-01-no-throw.grit',
  ]);
});
