import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  admin,
  anonymous,
  author,
  MODULE,
  makeContentEnv,
  moduleState,
  OTHER_MODULE,
  otherMentor,
  REQ,
  roleAuthor,
  STEP_1,
  STEP_2,
  student,
  textStep,
} from '../../content-uc.fixture';
import { GetStepUc } from './get-step.uc';

// Перенос `api/step/get-step-uc.test.ts` (4) на Def UC. Видимость шага
// считает `ModulePolicy.canSeeUnpublished` с модулем-владельцем; отказ —
// базовый ACCESS_DENIED (не STEP_ACCESS_DENIED). Правила видимости —
// `domain/src/module/module.policy.test.ts`, представление шага — `step.ar.test.ts`
// (TST-08). Пересмотр Ф4а: тело опубликованного шага — `canReadStepBody`
// (админ, автор модуля, MENTOR, AUTHOR); черновик и архив — `canSeeUnpublished`
// (админ, автор модуля).

let env: ReturnType<typeof makeContentEnv>;
beforeEach(() => {
  env = makeContentEnv();
  env.modules.seed(moduleState('published'));
});

const uc = () => new GetStepUc(env.deps, CourseModuleDef);
const get = (caller: Parameters<GetStepUc['handle']>[1], id = STEP_1) =>
  uc().handle({ stepId: id }, caller, REQ);

describe('GetStepUc — успех', () => {
  it('автор модуля видит DRAFT и archived шаг (canSeeUnpublished)', async () => {
    env.steps.seed(
      textStep(STEP_1, 'draft', { description: 'Шаг' }),
      textStep(STEP_2, 'archived', { description: 'Архив' }),
    );
    expect(expectOk(await get(author)).description).toBe('Шаг');
    expect(expectOk(await get(author, STEP_2)).description).toBe('Архив');
  });

  it('опубликованный шаг: ментор видит тело (canReadStepBody)', async () => {
    env.steps.seed(
      textStep(STEP_1, 'published', { description: 'Шаг', content: 'Тело' }),
    );

    const view = expectOk(await get(otherMentor));
    expect(view.uuid).toBe(STEP_1);
    expect(view.moduleId).toBe(MODULE);
    expect(view).toMatchObject({ content: 'Тело' });
  });
});

describe('GetStepUc — опубликованный шаг в неопубликованном модуле', () => {
  beforeEach(() => {
    env.modules.seed(moduleState('draft'));
    env.steps.seed(textStep(STEP_1, 'published', { content: 'Тело' }));
  });

  it('ментор и роль AUTHOR — ACCESS_DENIED, canSeeUnpublished', async () => {
    for (const caller of [otherMentor, roleAuthor]) {
      const error = expectErr(await get(caller), 'ACCESS_DENIED');
      expect(error.payload).toMatchObject({ rule: 'canSeeUnpublished' });
    }
  });

  it('автор модуля и админ — видят тело', async () => {
    for (const caller of [author, admin]) {
      expect(expectOk(await get(caller))).toMatchObject({ content: 'Тело' });
    }
  });
});

describe('GetStepUc — отказы по тексту шага', () => {
  it('опубликованный шаг: студент — ACCESS_DENIED, canReadStepBody', async () => {
    env.steps.seed(textStep(STEP_1, 'published'));

    const error = expectErr(await get(student), 'ACCESS_DENIED');

    expect(error.kind).toBe('access');
    expect(error.payload).toMatchObject({ rule: 'canReadStepBody' });
  });

  it('DRAFT и archived шаг: ментор (роль) — ACCESS_DENIED, canSeeUnpublished', async () => {
    env.steps.seed(textStep(STEP_1, 'draft'), textStep(STEP_2, 'archived'));

    for (const id of [STEP_1, STEP_2]) {
      const error = expectErr(await get(otherMentor, id), 'ACCESS_DENIED');
      expect(error.payload).toMatchObject({ rule: 'canSeeUnpublished' });
    }
  });
});

describe('GetStepUc — отказы', () => {
  it('шага нет — STEP_NOT_FOUND «Шаг не найден», kind not_found', async () => {
    const error = expectErr(await get(author), 'STEP_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ stepId: STEP_1 });
  });

  it('модуля-владельца нет — MODULE_NOT_FOUND', async () => {
    env.steps.seed(textStep(STEP_1, 'published', { moduleId: OTHER_MODULE }));

    const error = expectErr(await get(author), 'MODULE_NOT_FOUND');

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
