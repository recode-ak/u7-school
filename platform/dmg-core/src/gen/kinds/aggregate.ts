/** `gen aggregate <m>.<agg>` — домен агрегата (naming.md §2). */
import { join } from 'node:path';
import type { GenArgs } from '../cli';
import { namedExport, namedImport } from '../import-order';
import { toCamel, toPascal, toUpperSnake } from '../naming';
import type { GenPlan } from '../plan';
import { fit, list } from '../wrap';
import { createdNote } from './operation';

export function planDomainAggregate(args: GenArgs): GenPlan {
  const { module: m, aggregate: a = '' } = args;
  const P = toPascal(a);
  const idField = `${toCamel(a)}Id`;
  const root = args.layout.domainDir(m);
  const dir = join(root, a);
  const modulePath = join(root, `${m}.module.ts`);
  const indexPath = join(root, 'index.ts');

  // Поле payload события и ошибки на уровне \`pad\` (внутри \`created\` и
  // \`NOT_FOUND\`), с переносом по ширине.
  const payload = (pad: string) =>
    list(
      `${pad}  `,
      'payload: v.object({',
      [`${idField}: F.uuid('агрегата')`],
      '}),',
      { space: true },
    );

  const stateSrc = `import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';

/** Entity агрегата — единственное место структуры состояния. */
export const ${P}State = v.object({
  ...BaseEntityFields,
  // TODO: поля агрегата
  status: F.picklist(['active'], 'Статус'),
});

${list('', `export type ${P}State = v.InferOutput<`, [`typeof ${P}State`], '>;', { comma: false })}
`;

  const eventsSrc = `import { EventDef, F } from 'dmg-core';
import * as v from 'valibot';

${defineWithKey(`export const ${P}Events = EventDef.define`, `'${m}.${a}'`, [
  'created: {',
  "  label: 'TODO: событие создания',",
  "  description: 'TODO: когда возникает событие',",
  payload,
  '},',
])}
`;

  const errorsSrc = `import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

${defineWithKey(
  `export const ${P}Errors = ErrorDef.define`,
  `'${toUpperSnake(a)}'`,
  [
    'NOT_FOUND: {',
    "  kind: 'not_found',",
    "  label: 'TODO: агрегат не найден',",
    "  description: 'TODO: когда возникает ошибка',",
    payload,
    '},',
  ],
)}
`;

  const arSrc = `import {
  Aggregate,
  AggregateDef,
  type EventsOf,
  ok,
  type Result,
  type Timestamp,
} from 'dmg-core';
import { ${P}Errors } from './${a}.errors';
import { ${P}Events } from './${a}.events';
import { ${P}State } from './${a}.state';

export const ${P}ArDef = AggregateDef.define({
  name: '${a}',
  label: 'TODO: название агрегата',
  description: 'TODO: что это за агрегат и его жизненный цикл',
  state: ${P}State,
  statuses: {
    active: { label: 'TODO: статус' },
  },
  transitions: {},
  events: ${P}Events,
  errors: ${P}Errors,
});

${list('', `type ${P}Event = EventsOf<`, [`typeof ${P}ArDef`], '>;', { comma: false })}

export type Create${P} = {
  readonly uuid: string;
};

${list('', `export class ${P}Ar extends Aggregate<`, [`typeof ${P}ArDef`], '> {', { comma: false })}
${list('  ', 'private constructor(', [`state: ${P}State`, `events?: readonly ${P}Event[]`], ') {')}
    super(${P}ArDef, state, events);
  }

${list('  ', 'static create(', [`input: Create${P}`, 'at: Timestamp'], `): Result<${P}Ar, never> {`)}
${list('    ', `const created = ${P}Events.created.make({`, [`${idField}: input.uuid`], '});', { space: true })}
    const state: ${P}State = {
      ...${P}Ar.newState(input.uuid, at),
      status: 'active',
    };
    return ok(new ${P}Ar(state, [created]));
  }

${list('  ', 'static restore(', [`snapshot: ${P}State`], `): ${P}Ar {`)}
    return new ${P}Ar(snapshot);
  }
}
`;

  const policySrc = `import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { ${P}Ar } from './${a}.ar';

/** Контекст правил: агрегат, над которым действие. */
${fit(
  `export type ${P}Ctx = { readonly ${toCamel(a)}: ReadonlyAr<${P}Ar> };`,
  `export type ${P}Ctx = {\n  readonly ${toCamel(a)}: ReadonlyAr<${P}Ar>;\n};`,
)}

export const ${P}Policy = PolicyDef.define({
  name: '${a}',
  label: 'TODO: права на агрегат',
  description: 'TODO: кто и при каких условиях может действовать',
  rules: {
    canView: Rule.of({
      name: 'canView',
      label: 'TODO: кто может смотреть',
      denyMessage: 'TODO: почему отказано',
${list('      ', 'check: (', ['_subject: { readonly uuid: string }', `_ctx: ${P}Ctx`], ') => true,')}
    }),
  },
});
`;

  const arTestSrc = `import { describe, expect, it } from 'bun:test';
import { expectOk } from 'dmg-core/testing';
import { ${P}Ar } from './${a}.ar';

const ID = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const T0 = Date.UTC(2026, 9, 1);

describe('${P}Ar.create', () => {
  it('активный агрегат и событие created', () => {
${list('    ', 'const ar = expectOk(', [`${P}Ar.create({ uuid: ID }, T0)`], ');', { comma: true })}
    expect(ar.snapshot()).toEqual({
      uuid: ID,
      status: 'active',
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
    expect(ar.pullEvents()).toEqual([
${list('      ', '{', [`name: '${m}.${a}.created'`, `payload: { ${idField}: ID }`], '},', { space: true })}
    ]);
  });
});
`;

  const policyTestSrc = `import { describe, expect, it } from 'bun:test';
import { allowed } from 'dmg-core';
import { ${P}Ar } from './${a}.ar';
${namedImport([`type ${P}Ctx`, `${P}Policy`], `./${a}.policy`)}

type User = { uuid: string };

const ID = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';

const user: User = { uuid: ID };

const ctx: ${P}Ctx = {
  ${toCamel(a)}: ${P}Ar.restore({
    uuid: ID,
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
    version: 0,
  }),
};

describe('${P}Policy.canView', () => {
  it('пользователь — allowed', () => {
${expectEqual('    ', `${P}Policy.rules.canView.evaluate(user, ctx)`, 'allowed')}
  });
});
`;

  const file = (name: string, content: string) => ({
    path: join(dir, name),
    content,
  });
  const idx = (line: string) => ({
    path: indexPath,
    marker: '// gen:exports',
    line,
  });

  return {
    files: [
      file(`${a}.state.ts`, stateSrc),
      file(`${a}.events.ts`, eventsSrc),
      file(`${a}.errors.ts`, errorsSrc),
      file(`${a}.ar.ts`, arSrc),
      file(`${a}.policy.ts`, policySrc),
      file(`${a}.ar.test.ts`, arTestSrc),
      file(`${a}.policy.test.ts`, policyTestSrc),
    ],
    edits: [
      {
        path: modulePath,
        marker: '// gen:defs:imports',
        line: `import { ${P}ArDef } from './${a}/${a}.ar';`,
      },
      {
        path: modulePath,
        marker: '// gen:defs:aggregates',
        line: `    ${P}ArDef,`,
      },
      idx(namedExport([`${P}Ar`, `${P}ArDef`], `./${a}/${a}.ar`)),
      idx(`export { ${P}Errors } from './${a}/${a}.errors';`),
      idx(`export { ${P}Events } from './${a}/${a}.events';`),
      idx(namedExport([`type ${P}Ctx`, `${P}Policy`], `./${a}/${a}.policy`)),
    ],
    notes: [createdNote(m, a)],
  };
}

/**
 * \`export const X = Def.define('<ключ>', { … });\` в форме biome: с объектом,
 * прижатым к скобке, если шапка влезает, иначе — аргументы в столбик.
 * \`body\` — строки объекта без внешнего отступа; функция — строка, которой
 * нужен отступ (перенос по ширине на своём уровне).
 */
function defineWithKey(
  head: string,
  key: string,
  body: readonly (string | ((pad: string) => string))[],
): string {
  const lines = (pad: string) =>
    body
      .map((line) => (typeof line === 'string' ? `${pad}${line}` : line(pad)))
      .join('\n');
  return fit(
    `${head}(${key}, {\n${lines('  ')}\n});`,
    `${head}(\n  ${key},\n  {\n${lines('    ')}\n  },\n);`,
  );
}

/**
 * \`expect(<actual>).toEqual(<expected>);\` в форме biome: в строку; иначе
 * переносится аргумент последнего вызова, а если и так не влезает — первого.
 */
function expectEqual(pad: string, actual: string, expected: string): string {
  return fit(
    `${pad}expect(${actual}).toEqual(${expected});`,
    `${pad}expect(${actual}).toEqual(\n${pad}  ${expected},\n${pad});`,
    `${pad}expect(\n${pad}  ${actual},\n${pad}).toEqual(${expected});`,
  );
}
