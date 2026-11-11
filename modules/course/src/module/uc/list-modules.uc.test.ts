import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectOk } from 'dmg-core/testing';
import { ListModulesUc } from './list-modules.uc';
import {
  anonymous,
  author,
  makeEnv,
  REQ,
  state,
  student,
} from './module-uc.fixture';

// Перенос `api/module/list-modules-uc.test.ts` (3) + фильтры, сортировка,
// `limit` до отбора видимых (особенность v0.2.6, Т6). Выборку и сортировку
// делает репозиторий; отбор по видимости — `ModulePolicy.canSeeUnpublished`
// (`domain/src/module/module.policy.test.ts`), форма `ModuleSummary` —
// `module.ar.test.ts` (TST-08).

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  env = makeEnv();
});

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333334';
const OTHER_AUTHOR = '88888888-8888-4888-8888-888888888888';

const uc = () => new ListModulesUc(env.deps, CourseModuleDef);
const list = (
  input: Parameters<ListModulesUc['handle']>[0],
  caller: Parameters<ListModulesUc['handle']>[1] = student,
) => uc().handle(input, caller, REQ);

describe('ListModulesUc — успех', () => {
  it('возвращает список опубликованных модулей', async () => {
    env.answerWith(
      state('published', { uuid: U1 }),
      state('published', { uuid: U2 }),
    );

    expect(expectOk(await list({}))).toHaveLength(2);
  });

  it('гость: черновики и archived молча отбрасываются', async () => {
    env.answerWith(
      state('published', { uuid: U1 }),
      state('draft', { uuid: U2 }),
      state('archived', { uuid: U3 }),
    );

    const result = expectOk(await list({}, anonymous));

    expect(result.map((m) => m.uuid)).toEqual([U1]);
    expect(result[0]?.status).toBe('published');
  });

  it('автор видит свои черновики, чужие — нет', async () => {
    env.answerWith(
      state('draft', { uuid: U1 }),
      state('draft', { uuid: U2, authorId: OTHER_AUTHOR }),
      state('published', { uuid: U3, authorId: OTHER_AUTHOR }),
    );

    expect(expectOk(await list({}, author)).map((m) => m.uuid)).toEqual([
      U1,
      U3,
    ]);
  });

  it('порядок ответа репозитория сохраняется', async () => {
    env.answerWith(
      state('published', { uuid: U3 }),
      state('published', { uuid: U1 }),
      state('published', { uuid: U2 }),
    );

    expect(expectOk(await list({})).map((m) => m.uuid)).toEqual([U3, U1, U2]);
  });
});

describe('ListModulesUc — фильтры, сортировка, limit', () => {
  it('все условия уходят в репозиторий как есть', async () => {
    env.answerWith();
    const input = {
      status: 'published',
      authorId: OTHER_AUTHOR,
      title: 'js',
      tags: ['js', 'web'],
      sort: 'title:asc',
      limit: 5,
    };

    expectOk(await list(input));

    expect(env.asked.filter).toEqual(input);
  });

  it('limit применяется до отбора видимых: из 2 выбранных одна невидимая — в ответе 1', async () => {
    env.answerWith(
      state('draft', { uuid: U1 }),
      state('published', { uuid: U2 }),
    );

    const result = expectOk(await list({ limit: 2 }));

    expect(env.asked.filter).toEqual({ limit: 2 });
    expect(result.map((m) => m.uuid)).toEqual([U2]);
  });
});
