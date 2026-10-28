import { expect, test } from 'bun:test';
import { importBefore, sortImports } from './import-order';

test('порядок biome: встроенные (bun:, node:), пакеты, затем пути', () => {
  expect(
    sortImports([
      "import { a } from './a';",
      "import { ok } from 'dmg-core';",
      "import { join } from 'node:path';",
      "import { describe } from 'bun:test';",
      "import { T } from '../../domain/todo';",
      "import { D } from '@acme/domain/todo';",
    ]),
  ).toBe(
    [
      "import { describe } from 'bun:test';",
      "import { join } from 'node:path';",
      "import { D } from '@acme/domain/todo';",
      "import { ok } from 'dmg-core';",
      "import { T } from '../../domain/todo';",
      "import { a } from './a';",
    ].join('\n'),
  );
});

test('дальний родитель раньше ближнего, «.» раньше «-»', () => {
  expect(
    sortImports([
      "import { b } from './a-b.dcs';",
      "import { m } from '../../m.module';",
      "import { a } from './a.facade';",
      "import { d } from '../../../../domain/m';",
    ]).split('\n'),
  ).toEqual([
    "import { d } from '../../../../domain/m';",
    "import { m } from '../../m.module';",
    "import { a } from './a.facade';",
    "import { b } from './a-b.dcs';",
  ]);
});

test('многострочный импорт сортируется по источнику', () => {
  const long = "import {\n  A,\n  B,\n} from '../../domain/m';";
  expect(sortImports([long, "import { ok } from 'dmg-core';"])).toBe(
    `import { ok } from 'dmg-core';\n${long}`,
  );
});

test('importBefore: строки без источника не сравниваются', () => {
  expect(importBefore("import { a } from 'a';", '// gen:x')).toBe(undefined);
  expect(importBefore("import { a } from 'a';", "export * from './b';")).toBe(
    true,
  );
});

test('«/» раньше «.» и «-»: каталог агрегата раньше соседа с тем же префиксом', () => {
  expect(
    sortImports([
      "export { E } from './study-group-member.y';",
      "export { A } from './study-group-member/a';",
      "export { C } from './study-group.x';",
      "export { B } from './study-group/b';",
      "export { D } from './study/d';",
    ]),
  ).toBe(
    [
      "export { D } from './study/d';",
      "export { B } from './study-group/b';",
      "export { C } from './study-group.x';",
      "export { A } from './study-group-member/a';",
      "export { E } from './study-group-member.y';",
    ].join('\n'),
  );
});
