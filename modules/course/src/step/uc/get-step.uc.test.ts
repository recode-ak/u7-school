import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  anonymous,
  author,
  MODULE,
  makeContentEnv,
  moduleState,
  OTHER_MODULE,
  REQ,
  STEP_1,
  student,
  textStep,
} from '../../content-uc.fixture';
import { GetStepUc } from './get-step.uc';

// Перенос `api/step/get-step-uc.test.ts` (4) на Def UC. Видимость шага
// считает `ModulePolicy.canSeeUnpublished` с модулем-владельцем; отказ —
// базовый ACCESS_DENIED (не STEP_ACCESS_DENIED). Правила видимости —
// `domain/src/module/module.policy.test.ts`, представление шага — `step.ar.test.ts`
// (TST-08).

let env: ReturnType<typeof makeContentEnv>;
beforeEach(() => {
  env = makeContentEnv();
  env.modules.seed(moduleState('published'));
});

const uc = () => new GetStepUc(env.deps, CourseModuleDef);
const get = (caller: Parameters<GetStepUc['handle']>[1], id = STEP_1) =>
  uc().handle({ stepId: id }, caller, REQ);

describe('GetStepUc — успех', () => {
  it('опубликованный шаг виден гостю («PUBLISHED без актора»)', async () => {
    env.steps.seed(textStep(STEP_1, 'published', { description: 'Шаг' }));

    const view = expectOk(await get(anonymous));

    expect(view.description).toBe('Шаг');
    expect(view.uuid).toBe(STEP_1);
    expect(view.moduleId).toBe(MODULE);
  });

  it('автор модуля видит DRAFT шаг (без роли AUTHOR)', async () => {
    env.steps.seed(textStep(STEP_1, 'draft', { description: 'Шаг' }));
    expect(expectOk(await get(author)).description).toBe('Шаг');
  });
});

describe('GetStepUc — отказы', () => {
  it('шага нет — STEP_NOT_FOUND «Шаг не найден», kind not_found', async () => {
    const error = expectErr(await get(student), 'STEP_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ stepId: STEP_1 });
  });

  it('модуля-владельца нет — MODULE_NOT_FOUND', async () => {
    env.steps.seed(textStep(STEP_1, 'published', { moduleId: OTHER_MODULE }));

    const error = expectErr(await get(student), 'MODULE_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ moduleId: OTHER_MODULE });
  });

  it('гость на черновом модуле — ACCESS_DENIED (canSeeUnpublished)', async () => {
    env.steps.seed(textStep(STEP_1, 'draft'));

    const error = expectErr(await get(anonymous), 'ACCESS_DENIED');

    expect(error.kind).toBe('access');
    expect(error.payload).toMatchObject({ rule: 'canSeeUnpublished' });
  });
});
