/**
 * `gen module <m>` — домен модуля (naming.md §2). Фасада нет: это
 * рантайм-граница, его тип пишется руками по потребителю (D-42).
 */
import { join } from 'node:path';
import type { GenArgs } from '../cli';
import { toPascal } from '../naming';
import type { GenPlan } from '../plan';

export function planDomainModule(args: GenArgs): GenPlan {
  const { module: m } = args;
  const P = toPascal(m);
  const dir = args.layout.domainDir(m);

  const moduleSrc = `import { ModuleDef } from 'dmg-core';
// gen:defs:imports

export const ${P}ModuleDef = ModuleDef.define({
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

  // Контракт пополняется руками: что видно снаружи — решение автора (D-45).
  const contractSrc = `/**
 * Контракт модуля ${m} (D-45) — вход для остального кода: паспорт модуля,
 * Def внешних операций, события и ошибки. Ar, Policy, DCS/DQS, ArDef и
 * схемы entity сюда не входят.
 */

/** Кто: сборка приложения и \`dependsOn\` других модулей. Зачем: паспорт модуля. */
export { ${P}ModuleDef } from './${m}.module';
`;

  const indexSrc = `// API домена модуля ${m} для своего прикладного пакета (включая контракт).

export * from './contract';
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
      { path: join(dir, 'contract.ts'), content: contractSrc },
      { path: join(dir, 'index.ts'), content: indexSrc },
      { path: join(dir, `${m}.module.test.ts`), content: testSrc },
    ],
    edits: [],
  };
}
