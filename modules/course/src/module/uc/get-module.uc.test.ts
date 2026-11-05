import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { GetModuleUc } from './get-module.uc';
import {
  admin,
  anonymous,
  author,
  MODULE,
  makeEnv,
  otherMentor,
  PROJECT_DRAFT,
  PROJECT_PUBLISHED,
  projectState,
  REQ,
  state,
  student,
  system,
} from './module-uc.fixture';

// Перенос `api/module/get-module-uc.test.ts` (7) на Def UC. Видимость:
// UC `allowAll`, право на неопубликованное считает Policy внутри execute,
// отказ — базовый ACCESS_DENIED (не MODULE_ACCESS_DENIED).

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

  it('админ видит чужой черновик', async () => {
    env.modules.seed(state('draft'));
    expect(expectOk(await get(admin)).title).toBe('Основы JS');
  });

  it('автор видит archived', async () => {
    env.modules.seed(state('archived'));
    expect(expectOk(await get(author)).status).toBe('archived');
  });

  it('студент видит опубликованный модуль', async () => {
    env.modules.seed(state('published'));
    expect(expectOk(await get(student)).title).toBe('Основы JS');
  });

  it('гость и студент: у опубликованного модуля только опубликованные проекты', async () => {
    env.modules.seed(
      state('published', {
        projects: [projectState('published'), projectState('draft')],
      }),
    );

    for (const caller of [anonymous, student]) {
      const view = expectOk(await get(caller));
      expect(view.projects.map((p) => p.uuid)).toEqual([PROJECT_PUBLISHED]);
    }
  });

  it('автор и админ: у опубликованного модуля все проекты, включая черновые', async () => {
    env.modules.seed(
      state('published', {
        projects: [projectState('published'), projectState('draft')],
      }),
    );

    for (const caller of [author, admin]) {
      const view = expectOk(await get(caller));
      expect(view.projects.map((p) => p.uuid)).toEqual([
        PROJECT_PUBLISHED,
        PROJECT_DRAFT,
      ]);
    }
  });
});

describe('GetModuleUc — отказы', () => {
  it('модуля нет — MODULE_NOT_FOUND «Модуль не найден», kind not_found', async () => {
    const other = '99999999-9999-4999-8999-999999999999';

    const error = expectErr(await get(student, other), 'MODULE_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.label).toBe('Модуль не найден');
    expect(error.payload).toEqual({ moduleId: other });
  });

  it.each([
    ['гость, черновик', anonymous, 'draft'],
    ['студент, черновик', student, 'draft'],
    ['чужой ментор, черновик', otherMentor, 'draft'],
    ['гость, archived', anonymous, 'archived'],
    ['студент, archived', student, 'archived'],
  ] as const)(
    '%s — ACCESS_DENIED «Нет доступа к модулю»',
    async (_, caller, status) => {
      env.modules.seed(state(status));

      const error = expectErr(await get(caller), 'ACCESS_DENIED');

      expect(error.kind).toBe('access');
      expect(error.payload).toMatchObject({
        rule: 'canSeeUnpublished',
        denyMessage: 'Нет доступа к модулю',
      });
    },
  );

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    env.modules.seed(state('published'));

    const res = await uc().handle({ moduleId: MODULE }, system as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('неверный uuid во входе — INPUT_VALIDATION', async () => {
    expectErr(await get(student, 'not-a-uuid'), 'INPUT_VALIDATION');
  });
});
