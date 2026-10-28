import { describe, expect, test } from 'bun:test';
import { namedExport, namedImport } from './import-order';
import { fit, list } from './wrap';

const long = 'L'.repeat(76);

describe('fit', () => {
  test('первый вариант, все строки которого влезают в 80', () => {
    expect(fit('a'.repeat(81), 'b\nc')).toBe('b\nc');
    expect(fit('short', 'b')).toBe('short');
  });

  test('ни один не влез — последний', () => {
    expect(fit('a'.repeat(81), 'b'.repeat(90))).toBe('b'.repeat(90));
  });
});

describe('list', () => {
  test('в строку, если влезает', () => {
    expect(list('  ', 'f(', ['a', 'b'], ');')).toBe('  f(a, b);');
  });

  test('иначе по элементу на строку с запятой', () => {
    expect(list('  ', 'f(', [long, 'b'], ');')).toBe(
      `  f(\n    ${long},\n    b,\n  );`,
    );
  });

  test('объект — пробелы внутри скобок; типовые аргументы — без запятой', () => {
    expect(list('', 'x = {', ['a'], '};', { space: true })).toBe('x = { a };');
    expect(list('', 'T<', [long, 'B'], '>;', { comma: false })).toBe(
      `T<\n  ${long},\n  B\n>;`,
    );
  });
});

describe('namedImport и namedExport', () => {
  test('одно имя biome не переносит', () => {
    expect(namedImport([long], './x')).toBe(`import { ${long} } from './x';`);
  });

  test('реэкспорт переносится как импорт', () => {
    expect(namedExport([long, 'B'], './x')).toBe(
      `export {\n  ${long},\n  B,\n} from './x';`,
    );
  });
});
