/**
 * `gen module <m>` — домен модуля (naming.md §2). Фасада нет: это
 * рантайм-граница, его тип пишется руками по потребителю (D-42).
 */
import { join } from 'node:path';
import type { GenArgs } from '../cli.ts';
import { toPascal } from '../naming.ts';
import type { GenPlan } from '../plan.ts';

export function planDomainModule(args: GenArgs): GenPlan {
  const { module: m } = args;
  const P = toPascal(m);
  const dir = join(args.domainRoot, m);

  const moduleSrc = `import { defineModule } from 'dmg-core';
// gen:defs:imports

export const ${P}ModuleDef = defineModule({
  name: '${m}',
  label: 'TODO: название модуля',
  description: 'TODO: что делает модуль',
  dependsOn: [],
  aggregates: [
    // gen:defs:aggregates
  ],
  useCases: [
    // gen:defs:useCases
  ],
  reactions: [
    // gen:defs:reactions
  ],
  jobs: [
    // gen:defs:jobs
  ],
});
`;

  const indexSrc = `// Публичный API модуля ${m}.

export { ${P}ModuleDef } from './${m}.module';
// gen:exports
`;

  const testSrc = `import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { ${P}ModuleDef } from './${m}.module';

describe('${P}ModuleDef', () => {
  it('паспорт нормализуется', () => {
    expect(normalize(${P}ModuleDef)).toMatchObject({
      name: '${m}',
    });
  });
});
`;

  return {
    files: [
      { path: join(dir, `${m}.module.ts`), content: moduleSrc },
      { path: join(dir, 'index.ts'), content: indexSrc },
      { path: join(dir, `${m}.module.test.ts`), content: testSrc },
    ],
    edits: [],
  };
}
