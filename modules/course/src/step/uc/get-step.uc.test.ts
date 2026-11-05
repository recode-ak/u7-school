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
  OTHER_ID,
  OTHER_MODULE,
  otherMentor,
  REQ,
  STEP_1,
  student,
  system,
  textStep,
} from '../../content-uc.fixture';
import { GetStepUc } from './get-step.uc';

// Перенос `api/step/get-step-uc.test.ts` (4) на Def UC. Видимость шага
// считает `ModulePolicy.canSeeUnpublished` с модулем-владельцем; отказ —
// базовый ACCESS_DENIED (не STEP_ACCESS_DENIED).

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

  it('опубликованный шаг виден студенту', async () => {
    env.steps.seed(textStep(STEP_1, 'published'));
    expect(expectOk(await get(student)).status).toBe('published');
  });

  it('автор модуля видит DRAFT шаг (без роли AUTHOR)', async () => {
    env.steps.seed(textStep(STEP_1, 'draft', { description: 'Шаг' }));
    expect(expectOk(await get(author)).description).toBe('Шаг');
  });

  it('администратор видит чужой DRAFT шаг', async () => {
    env.steps.seed(textStep(STEP_1, 'draft'));
    expect(expectOk(await get(admin)).status).toBe('draft');
  });

  it('автор видит archived шаг', async () => {
    env.steps.seed(textStep(STEP_1, 'archived'));
    expect(expectOk(await get(author)).status).toBe('archived');
  });

  it('опубликованный шаг виден гостю, даже если модуль в черновике', async () => {
    env.modules.seed(moduleState('draft'));
    env.steps.seed(textStep(STEP_1, 'published'));

    expect(expectOk(await get(anonymous)).uuid).toBe(STEP_1);
  });

  it('text: content и kind; даты числами, version', async () => {
    env.steps.seed(textStep(STEP_1, 'published', { content: 'Текст' }));

    const view = expectOk(await get(student));

    expect(view).toMatchObject({ kind: 'text', content: 'Текст', version: 0 });
    expect(typeof view.createdAt).toBe('number');
  });

  it('code: код и язык', async () => {
    env.steps.seed({
      uuid: STEP_1,
      moduleId: MODULE,
      kind: 'code',
      description: 'Код',
      code: 'console.log(1)',
      language: 'js',
      status: 'published',
      createdAt: 1,
      updatedAt: 1,
      version: 0,
    });

    expect(expectOk(await get(student))).toMatchObject({
      kind: 'code',
      code: 'console.log(1)',
      language: 'js',
    });
  });

  it('file: метаданные файла', async () => {
    const file = {
      uuid: '99999999-9999-4999-8999-999999999999',
      name: 'doc.pdf',
      mimeType: 'application/pdf',
      size: 2048,
    };
    env.steps.seed({
      uuid: STEP_1,
      moduleId: MODULE,
      kind: 'file',
      description: 'Файл',
      file,
      status: 'published',
      createdAt: 1,
      updatedAt: 1,
      version: 0,
    });

    expect(expectOk(await get(student))).toMatchObject({ kind: 'file', file });
  });

  it('шаг только читается: ничего не записывается', async () => {
    env.steps.seed(textStep(STEP_1, 'published'));
    await get(student);
    expect(env.steps.saved).toEqual([]);
  });
});

describe('GetStepUc — отказы', () => {
  it('шага нет — STEP_NOT_FOUND «Шаг не найден», kind not_found', async () => {
    const error = expectErr(await get(student), 'STEP_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.label).toBe('Шаг не найден');
    expect(error.payload).toEqual({ stepId: STEP_1 });
  });

  it('модуля-владельца нет — MODULE_NOT_FOUND', async () => {
    env.steps.seed(textStep(STEP_1, 'published', { moduleId: OTHER_MODULE }));

    const error = expectErr(await get(student), 'MODULE_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ moduleId: OTHER_MODULE });
  });

  it.each([
    ['гость, draft', anonymous, 'draft'],
    ['студент, draft', student, 'draft'],
    ['чужой ментор, draft', otherMentor, 'draft'],
    ['гость, archived', anonymous, 'archived'],
    ['студент, archived', student, 'archived'],
  ] as const)(
    '%s — ACCESS_DENIED «Нет доступа к модулю»',
    async (_, caller, status) => {
      env.steps.seed(textStep(STEP_1, status));

      const error = expectErr(await get(caller), 'ACCESS_DENIED');

      expect(error.kind).toBe('access');
      expect(error.payload).toMatchObject({
        rule: 'canSeeUnpublished',
        denyMessage: 'Нет доступа к модулю',
      });
    },
  );

  it('автор другого модуля не видит DRAFT шаг этого модуля (право — по модулю-владельцу шага)', async () => {
    env.modules.seed(
      moduleState('published', { uuid: OTHER_MODULE, authorId: OTHER_ID }),
    );
    env.steps.seed(textStep(STEP_1, 'draft'));

    expectErr(await get(otherMentor), 'ACCESS_DENIED');
  });

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    env.steps.seed(textStep(STEP_1, 'published'));

    const res = await uc().handle({ stepId: STEP_1 }, system as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('неверный uuid во входе — INPUT_VALIDATION', async () => {
    expectErr(await get(student, 'not-a-uuid'), 'INPUT_VALIDATION');
  });

  it('прежнее имя поля uuid во входе — INPUT_VALIDATION (Т8)', async () => {
    const res = await uc().handle({ uuid: STEP_1 } as never, student, REQ);
    expectErr(res, 'INPUT_VALIDATION');
  });
});
