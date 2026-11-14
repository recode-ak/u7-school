import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { GetModuleUc } from './get-module.uc';
import {
  anonymous,
  author,
  MODULE,
  makeEnv,
  otherMentor,
  REQ,
  state,
  student,
} from './module-uc.fixture';

// Перенос `api/module/get-module-uc.test.ts` (7) на Def UC. Видимость:
// UC `allowAll`, право на неопубликованное считает Policy внутри execute,
// отказ — базовый ACCESS_DENIED (не MODULE_ACCESS_DENIED). Правила видимости —
// `domain/src/module/module.policy.test.ts`, проекты модуля — `module.ar.test.ts`
// (TST-08).

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  env = makeEnv();
});

const uc = () => new GetModuleUc(env.deps, CourseModuleDef);
const get = (caller: Parameters<GetModuleUc['handle']>[1], id = MODULE) =>
  uc().handle({ moduleId: id }, caller, REQ);

describe('GetModuleUc — успех', () => {
  it('опубликованный модуль виден гостю («PUBLISHED без актора»)', async () => {
    env.modules.seed(state('published'));

    const view = expectOk(await get(anonymous));

    expect(view.title).toBe('Основы JS');
    expect(view.uuid).toBe(MODULE);
    expect(typeof view.createdAt).toBe('number');
  });

  it('автор видит свой черновик (без роли AUTHOR)', async () => {
    env.modules.seed(state('draft'));
    expect(expectOk(await get(author)).status).toBe('draft');
  });

  it('ментор (роль), не автор, видит чужой черновик (Ф4а)', async () => {
    env.modules.seed(state('draft'));
    expect(expectOk(await get(otherMentor)).status).toBe('draft');
  });

  it('студент не видит чужой черновик — ACCESS_DENIED (Ф4а)', async () => {
    env.modules.seed(state('draft'));
    expectErr(await get(student), 'ACCESS_DENIED');
  });
});

describe('GetModuleUc — отказы', () => {
  it('модуля нет — MODULE_NOT_FOUND, kind not_found', async () => {
    const other = '99999999-9999-4999-8999-999999999999';

    const error = expectErr(await get(student, other), 'MODULE_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ moduleId: other });
  });

  it('гость на черновике — ACCESS_DENIED (canSeeUnpublished)', async () => {
    env.modules.seed(state('draft'));

    const error = expectErr(await get(anonymous), 'ACCESS_DENIED');

    expect(error.kind).toBe('access');
    expect(error.payload).toMatchObject({ rule: 'canSeeUnpublished' });
  });
});
