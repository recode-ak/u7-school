import { describe, expect, it } from 'bun:test';
import { checkDelivered, REQUIRED } from './consumer-check';

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
