// Контракт трека dmg-core-oop (спека п.3): поведение вида живёт в классе
// вида, а не в `switch` по дискриминатору в чужом коде. `gen` добавляется
// в проверку, когда шаблоны операций переходят в вид (Фаза 5).
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dir, '..');
const DIRS = ['graph', 'arch'];

/**
 * Ветвление по виду: `switch (x.dmg)` / `.op`, сравнение `.dmg === '…'`
 * в любом порядке, таблица по виду `TABLE[x.dmg]`.
 */
const KIND_BRANCH = new RegExp(
  [
    String.raw`switch\s*\(\s*[\w.]+\.(?:dmg|op)\s*\)`,
    String.raw`\.(?:dmg|op)\s*[!=]==\s*['"]`,
    String.raw`['"]\s*[!=]==\s*[\w.]+\.(?:dmg|op)\b`,
    String.raw`\[\s*[\w.]+\.(?:dmg|op)\s*\]`,
  ].join('|'),
);

function sources(dir: string): string[] {
  return [...new Bun.Glob('**/*.ts').scanSync({ cwd: join(SRC, dir) })]
    .filter((f) => !f.endsWith('.test.ts'))
    .map((f) => `${dir}/${f}`);
}

describe('нет ветвления по виду Def', () => {
  it.each(DIRS)('%s: только полиморфные вызовы', (dir) => {
    const offenders = sources(dir).flatMap((f) =>
      readFileSync(join(SRC, f), 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          KIND_BRANCH.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [],
        ),
    );
    expect(offenders).toEqual([]);
  });

  it('шаблон ловит switch и сравнение по виду', () => {
    expect(KIND_BRANCH.test('switch (def.dmg) {')).toBe(true);
    expect(KIND_BRANCH.test('switch (rule.op) {')).toBe(true);
    expect(KIND_BRANCH.test("op.dmg === 'useCase'")).toBe(true);
    expect(KIND_BRANCH.test("'job' !== op.dmg")).toBe(true);
    expect(KIND_BRANCH.test('OPERATION_DIR[op.dmg]')).toBe(true);
    expect(KIND_BRANCH.test('return def.normalize();')).toBe(false);
  });
});
