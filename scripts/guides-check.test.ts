import { describe, expect, it } from 'bun:test';
import { checkGuides, type GuideFile, readGuides } from './guides-check';

const DIR = 'conductor/architecture/guides';
const RULES = new Set(['DOM-02', 'API-01']);
const EXISTING = new Set([
  `${DIR}/aggregate.md`,
  'packages/domain/src/wish/wish/wish.ar.ts',
  'conductor/architecture/rules.md',
]);
const exists = (path: string) => EXISTING.has(path);

const guide = (text: string): GuideFile => ({
  path: `${DIR}/aggregate.md`,
  text,
});

describe('checkGuides: ссылки гайдов', () => {
  it('живые ссылки и ID правил — без нарушений', () => {
    const files = [
      guide(
        '[Ar](../../../packages/domain/src/wish/wish/wish.ar.ts) DOM-02\n' +
          '[rules](../rules.md#dom) [сайт](https://example.com)',
      ),
    ];
    expect(checkGuides(files, exists, RULES)).toEqual([]);
  });

  it('битая ссылка на файл — нарушение с путём', () => {
    const files = [guide('[Ar](../../../packages/domain/src/wish/a-root.ts)')];
    expect(checkGuides(files, exists, RULES)).toEqual([
      `${DIR}/aggregate.md: ссылка ведёт в несуществующий файл ../../../packages/domain/src/wish/a-root.ts`,
    ]);
  });

  it('неизвестный ID правила — нарушение', () => {
    const files = [guide('Проверь DOM-02 и DOM-99.')];
    expect(checkGuides(files, exists, RULES)).toEqual([
      `${DIR}/aggregate.md: правило DOM-99 нет в rules.md`,
    ]);
  });
});

describe('гайды эталона (контракт)', () => {
  it('ссылки на файлы и ID правил живые', () => {
    const { files, exists, rules } = readGuides();
    expect(files.length).toBeGreaterThan(0);
    expect(checkGuides(files, exists, rules)).toEqual([]);
  });
});
