import { expect, test } from 'bun:test';
import { relative } from 'node:path';
import { parseArgs } from './cli.ts';
import { planOperation } from './kinds/operation.ts';

const DOMAIN = '/d/stream';
const APP = '/p/stream/src';

/** Правило пары (naming.md §3, MAN-10): путь относительно `src/<m>/` одинаков. */
test.each(['uc', 'er', 'job'] as const)(
  '%s: контракт и реализация лежат по одному относительному пути',
  (kind) => {
    const plan = planOperation(
      parseArgs([
        kind,
        'stream.student',
        'do-thing',
        '--domain-root',
        '/d',
        '--packages-root',
        '/p',
      ]),
    );
    const rels = (root: string) =>
      plan.files
        .filter((f) => f.path.startsWith(`${root}/`))
        .map((f) => relative(root, f.path));
    expect(rels(DOMAIN)).toEqual([
      `student/${kind}/do-thing.${kind}.ts`,
      `student/${kind}/do-thing.${kind}.test.ts`,
    ]);
    expect(rels(APP)).toEqual(rels(DOMAIN));
  },
);

test('имена пары: контракт — XxxDef, реализация — Xxx', () => {
  const plan = planOperation(
    parseArgs([
      'uc',
      'stream.student',
      'do-thing',
      '--domain-root',
      '/d',
      '--packages-root',
      '/p',
    ]),
  );
  const [contract, , impl] = plan.files;
  expect(contract?.content).toContain('export const DoThingUcDef =');
  expect(impl?.content).toContain('export class DoThingUc ');
});
