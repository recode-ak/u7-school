import { describe, expect, it } from 'bun:test';
import { ImportBlock } from './import-block';

const MARKER = '// gen:imports';

/** Вставляет `line` в блок над маркером; возвращает результат и итоговый текст. */
const insert = (lines: string[], line: string) => {
  const copy = [...lines, MARKER];
  const result = ImportBlock.above(copy, copy.length - 1).insert(line);
  return { result, text: copy.join('\n') };
};

describe('ImportBlock', () => {
  it('вставляет импорт в порядке источников (как biome)', () => {
    const { result, text } = insert(
      ["import { a } from 'a-pkg';", "import { z } from 'z-pkg';"],
      "import { m } from 'm-pkg';",
    );
    expect(result).toEqual({ kind: 'inserted' });
    expect(text).toBe(
      [
        "import { a } from 'a-pkg';",
        "import { m } from 'm-pkg';",
        "import { z } from 'z-pkg';",
        MARKER,
      ].join('\n'),
    );
  });

  it('пустой блок — вставка прямо над маркером', () => {
    const { text } = insert([], "import { a } from 'a-pkg';");
    expect(text).toBe(`import { a } from 'a-pkg';\n${MARKER}`);
  });

  it('сливает имена из одного источника в отсортированный список', () => {
    const { result, text } = insert(
      ["import { b } from 'pkg';"],
      "import { a } from 'pkg';",
    );
    expect(result).toEqual({ kind: 'inserted' });
    expect(text).toBe(`import { a, b } from 'pkg';\n${MARKER}`);
  });

  it('сливает с многострочным импортом', () => {
    const { result, text } = insert(
      ['import {', '  bbbb,', '  cccc,', "} from 'pkg';"],
      "import { aaaa } from 'pkg';",
    );
    expect(result).toEqual({ kind: 'inserted' });
    expect(text).toBe(`import { aaaa, bbbb, cccc } from 'pkg';\n${MARKER}`);
  });

  it('многострочный импорт остаётся целым блоком при вставке выше него', () => {
    const { text } = insert(
      ['import {', '  bbbb,', '  cccc,', "} from 'pkg';"],
      "import { a } from 'a-pkg';",
    );
    expect(text).toBe(
      [
        "import { a } from 'a-pkg';",
        'import {',
        '  bbbb,',
        '  cccc,',
        "} from 'pkg';",
        MARKER,
      ].join('\n'),
    );
  });

  it('импорты типов и значений из одного источника не сливаются', () => {
    const { result, text } = insert(
      ["import { a } from 'pkg';"],
      "import type { B } from 'pkg';",
    );
    expect(result).toEqual({ kind: 'inserted' });
    expect(text.split('\n')).toContain("import { a } from 'pkg';");
    expect(text.split('\n')).toContain("import type { B } from 'pkg';");
  });

  it('то же имя из другого источника — conflict, строки не тронуты', () => {
    const lines = ["import { Foo } from 'one';"];
    const { result, text } = insert(lines, "import { Foo } from 'two';");
    expect(result).toEqual({ kind: 'conflict', name: 'Foo', from: 'one' });
    expect(text).toBe(`${lines[0]}\n${MARKER}`);
  });

  it('конфликт учитывает локальное имя `as`', () => {
    const { result } = insert(
      ["import { A as Foo } from 'one';"],
      "import { Foo } from 'two';",
    );
    expect(result).toEqual({ kind: 'conflict', name: 'Foo', from: 'one' });
  });

  it('повтор оператора или имён — present, без изменений', () => {
    const lines = ["import { a, b } from 'pkg';"];
    for (const line of [
      "import { a, b } from 'pkg';",
      "import { b } from 'pkg';",
    ]) {
      const { result, text } = insert(lines, line);
      expect(result).toEqual({ kind: 'present' });
      expect(text).toBe(`${lines[0]}\n${MARKER}`);
    }
  });
});
