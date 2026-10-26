import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { checkDocs, type DocFile, readDocs } from './docs-check';

const RULES = new Set(['DOM-02', 'API-01']);
const EXISTING = new Set([
  'docs/guides/aggregate.md',
  'docs/rules.md',
  'src/testing/example/todo/task/task.ar.ts',
]);
const exists = (path: string) => EXISTING.has(path);

const doc = (text: string, path = 'docs/guides/aggregate.md'): DocFile => ({
  path,
  text,
});

describe('checkDocs: ссылки и ID правил', () => {
  it('живые ссылки и ID правил — без нарушений', () => {
    const files = [
      doc(
        '[Ar](../../src/testing/example/todo/task/task.ar.ts) DOM-02\n' +
          '[rules](../rules.md#dom) [сайт](https://example.com) [тут](#1-когда)',
      ),
    ];
    expect(checkDocs(files, exists, RULES)).toEqual([]);
  });

  it('битая ссылка на файл — нарушение с путём', () => {
    const files = [doc('[Ar](../../src/testing/example/todo/a-root.ts)')];
    expect(checkDocs(files, exists, RULES)).toEqual([
      'docs/guides/aggregate.md: ссылка ведёт в несуществующий файл ../../src/testing/example/todo/a-root.ts',
    ]);
  });

  it('ссылка за пределы пакета — нарушение, даже если файл есть', () => {
    const files = [doc('[wish](../../../domain/src/wish.ts)')];
    expect(checkDocs(files, () => true, RULES)).toEqual([
      'docs/guides/aggregate.md: ссылка выходит за пределы пакета ../../../domain/src/wish.ts',
    ]);
  });

  it('неизвестный ID правила — нарушение', () => {
    const files = [doc('Проверь DOM-02 и DOM-99.')];
    expect(checkDocs(files, exists, RULES)).toEqual([
      'docs/guides/aggregate.md: правило DOM-99 нет в docs/rules.md',
    ]);
  });
});

describe('документация пакета (контракт)', () => {
  it('ссылки живые, внутри пакета; ID правил — из docs/rules.md', () => {
    const { files, exists, rules } = readDocs(join(import.meta.dir, '..'));
    const paths = files.map((f) => f.path);
    expect(paths).toContain('llms.txt');
    expect(paths).toContain('docs/guides/use-case.md');
    expect(paths).toContain('skills/dmg-architecture/SKILL.md');
    expect(paths).toContain('agents/roles/reviewer.md');
    expect(rules.size).toBeGreaterThan(50);
    expect(checkDocs(files, exists, rules)).toEqual([]);
  });
});
