/** `gen aggregate <m>.<agg>` — домен агрегата (naming.md §2). */
import { join } from 'node:path';
import type { GenArgs } from '../cli.ts';
import { toCamel, toPascal, toUpperSnake } from '../naming.ts';
import type { GenPlan } from '../plan.ts';

export function planDomainAggregate(args: GenArgs): GenPlan {
  const { module: m, aggregate: a = '' } = args;
  const P = toPascal(a);
  const idField = `${toCamel(a)}Id`;
  const dir = join(args.domainRoot, m, a);
  const modulePath = join(args.domainRoot, m, `${m}.module.ts`);
  const indexPath = join(args.domainRoot, m, 'index.ts');

  const stateSrc = `import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';

/** Entity агрегата — единственное место структуры состояния. */
export const ${P}State = v.object({
  ...BaseEntityFields,
  // TODO: поля агрегата
  status: F.picklist(['active'], 'Статус'),
});

export type ${P}State = v.InferOutput<typeof ${P}State>;
`;

  const eventsSrc = `import { defineEvents, F } from 'dmg-core';
import * as v from 'valibot';

export const ${P}Events = defineEvents('${m}.${a}', {
  created: {
    label: 'TODO: событие создания',
    description: 'TODO: когда возникает событие',
    payload: v.object({ ${idField}: F.uuid('агрегата') }),
  },
});
`;

  const errorsSrc = `import { defineErrors, F } from 'dmg-core';
import * as v from 'valibot';

export const ${P}Errors = defineErrors('${toUpperSnake(a)}', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'TODO: агрегат не найден',
    description: 'TODO: когда возникает ошибка',
    payload: v.object({ ${idField}: F.uuid('агрегата') }),
  },
});
`;

  const arSrc = `import {
  Aggregate,
  defineAggregate,
  type EventsOf,
  newEntity,
  ok,
  type Result,
  type Timestamp,
} from 'dmg-core';
import { ${P}Errors } from './${a}.errors';
import { ${P}Events } from './${a}.events';
import { ${P}State } from './${a}.state';

export const ${P}ArDef = defineAggregate({
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

type ${P}Event = EventsOf<typeof ${P}ArDef>;

export type Create${P} = {
  readonly uuid: string;
};

export class ${P}Ar extends Aggregate<typeof ${P}ArDef> {
  private constructor(state: ${P}State, events?: readonly ${P}Event[]) {
    super(${P}ArDef, state, events);
  }

  static create(input: Create${P}, at: Timestamp): Result<${P}Ar, never> {
    const created = ${P}Events.created.make({ ${idField}: input.uuid });
    const state: ${P}State = {
      ...newEntity(input.uuid, at),
      status: 'active',
    };
    return ok(new ${P}Ar(state, [created]));
  }

  static restore(snapshot: ${P}State): ${P}Ar {
    return new ${P}Ar(snapshot);
  }
}
`;

  const policySrc = `import { definePolicy, type ReadonlyAr, rule } from 'dmg-core';
import type { ${P}Ar } from './${a}.ar';

/** Контекст правил: агрегат, над которым действие. */
export type ${P}Ctx = { readonly ${toCamel(a)}: ReadonlyAr<${P}Ar> };

export const ${P}Policy = definePolicy({
  name: '${a}',
  label: 'TODO: права на агрегат',
  description: 'TODO: кто и при каких условиях может действовать',
  rules: {
    canView: rule({
      name: 'canView',
      label: 'TODO: кто может смотреть',
      denyMessage: 'TODO: почему отказано',
      check: (_subject: { readonly uuid: string }, _ctx: ${P}Ctx) => true,
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
    const ar = expectOk(${P}Ar.create({ uuid: ID }, T0));
    expect(ar.snapshot()).toEqual({
      uuid: ID,
      status: 'active',
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
    expect(ar.pullEvents()).toEqual([
      { name: '${m}.${a}.created', payload: { ${idField}: ID } },
    ]);
  });
});
`;

  const policyTestSrc = `import { describe, expect, it } from 'bun:test';
import { allowed, type Caller } from 'dmg-core';
import { ${P}Ar } from './${a}.ar';
import { type ${P}Ctx, ${P}Policy } from './${a}.policy';

type User = { uuid: string };

const ID = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';

const user: Caller<User> = { kind: 'user', user: { uuid: ID } };

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
    expect(${P}Policy.rules.canView.evaluate(user, ctx)).toEqual(allowed);
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
      idx(`export { ${P}Ar, ${P}ArDef } from './${a}/${a}.ar';`),
      idx(`export { ${P}Errors } from './${a}/${a}.errors';`),
      idx(`export { ${P}Events } from './${a}/${a}.events';`),
      idx(`export { type ${P}Ctx, ${P}Policy } from './${a}/${a}.policy';`),
    ],
  };
}
