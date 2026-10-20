/** `gen module <m> [--facade]` — домен модуля (naming.md §2). */
import { join } from 'node:path';
import type { GenArgs } from '../cli.ts';
import { toPascal } from '../naming.ts';
import type { GenPlan } from '../plan.ts';

export function planDomainModule(args: GenArgs): GenPlan {
  const { module: m, facade } = args;
  const P = toPascal(m);
  const dir = join(args.domainRoot, m);
  // Фасад — только по потребителю (D-38): без --facade его нет нигде.
  const facadeImport = facade
    ? `import { ${P}FacadeDef } from './${m}.facade';\n`
    : '';
  const facadeField = facade ? `  facade: ${P}FacadeDef,\n` : '';
  const facadeExport = facade
    ? `export { ${P}FacadeDef } from './${m}.facade';\n`
    : '';
  const facadeExpect = facade ? `      facade: '${m}',\n` : '';

  const moduleSrc = `import { defineModule } from 'dmg-core';
${facadeImport}// gen:defs:imports

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
${facadeField}});
`;

  const facadeSrc = `import { defineFacade } from 'dmg-core';

export const ${P}FacadeDef = defineFacade({
  name: '${m}',
  label: 'TODO: название фасада',
  description: 'TODO: какое runtime-API модуль даёт другим модулям',
  methods: {},
});
`;

  const indexSrc = `// Публичный API модуля ${m}.

${facadeExport}export { ${P}ModuleDef } from './${m}.module';
// gen:exports
`;

  const testSrc = `import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { ${P}ModuleDef } from './${m}.module';

describe('${P}ModuleDef', () => {
  it('паспорт нормализуется', () => {
    expect(normalize(${P}ModuleDef)).toMatchObject({
      name: '${m}',
${facadeExpect}    });
  });
});
`;

  return {
    files: [
      { path: join(dir, `${m}.module.ts`), content: moduleSrc },
      ...(facade
        ? [{ path: join(dir, `${m}.facade.ts`), content: facadeSrc }]
        : []),
      { path: join(dir, 'index.ts'), content: indexSrc },
      { path: join(dir, `${m}.module.test.ts`), content: testSrc },
    ],
    edits: [],
  };
}
