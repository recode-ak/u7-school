/** `gen dcs|dqs <m> <topic>` — доменные сервисы модуля (naming.md §2). */
import { join } from 'node:path';
import type { GenArgs } from '../cli.ts';
import { kindNames } from '../naming.ts';
import type { GenPlan } from '../plan.ts';

const NOTES = {
  dcs: '// TODO: операции над несколькими агрегатами; возвращают Result (DOM-06)',
  dqs: '// TODO: вычисления на чтение поверх агрегатов; без мутаций (DOM-07)',
} as const;

export function planDomainService(args: GenArgs): GenPlan {
  const kind = args.kind as 'dcs' | 'dqs';
  const topic = args.name ?? '';
  const { className, fileName } = kindNames(kind, topic);
  const dir = join(args.domainRoot, args.module);
  const base = fileName.replace(/\.ts$/, '');

  const src = `export class ${className} {
  ${NOTES[kind]}
}
`;

  const testSrc = `import { describe, expect, it } from 'bun:test';
import { ${className} } from './${base}';

describe('${className}', () => {
  it('создаётся', () => {
    expect(new ${className}()).toBeInstanceOf(${className});
  });
});
`;

  return {
    files: [
      { path: join(dir, fileName), content: src },
      { path: join(dir, `${base}.test.ts`), content: testSrc },
    ],
    edits: [
      {
        path: join(dir, 'index.ts'),
        marker: '// gen:exports',
        line: `export { ${className} } from './${base}';`,
      },
    ],
  };
}
