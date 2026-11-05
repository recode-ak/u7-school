import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { ListModulesUc } from './list-modules.uc';
import {
  admin,
  anonymous,
  author,
  makeEnv,
  REQ,
  state,
  student,
  system,
} from './module-uc.fixture';

// Перенос `api/module/list-modules-uc.test.ts` (3) + фильтры, сортировка,
// `limit` до отбора видимых (особенность v0.2.6, Т6) и форма ответа
// `ModuleSummary` (С2). Выборку и сортировку делает репозиторий.

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

  it('студент: чужие черновики отбрасываются', async () => {
    env.answerWith(
      state('published', { uuid: U1 }),
      state('draft', { uuid: U2 }),
    );

    expect(expectOk(await list({})).map((m) => m.uuid)).toEqual([U1]);
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

  it('админ видит всё', async () => {
    env.answerWith(
      state('draft', { uuid: U1 }),
      state('archived', { uuid: U2 }),
      state('published', { uuid: U3 }),
    );

    expect(expectOk(await list({}, admin))).toHaveLength(3);
  });

  it('пустой список', async () => {
    env.answerWith();

    expect(expectOk(await list({}))).toEqual([]);
  });

  it('порядок ответа репозитория сохраняется', async () => {
    env.answerWith(
      state('published', { uuid: U3 }),
      state('published', { uuid: U1 }),
      state('published', { uuid: U2 }),
    );

    expect(expectOk(await list({})).map((m) => m.uuid)).toEqual([U3, U1, U2]);
  });

  it('элемент — ModuleSummary: uuid, title, description, status, tags; без проектов', async () => {
    env.answerWith(
      state('published', { uuid: U1, goal: 'Цель', tags: ['js', 'web'] }),
    );

    const [item] = expectOk(await list({}));

    expect(item).toEqual({
      uuid: U1,
      title: 'Основы JS',
      description: 'Изучаем синтаксис языка',
      status: 'published',
      tags: ['js', 'web'],
    });
    expect(item && 'projects' in item).toBe(false);
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

  it('только status — фильтр { status }', async () => {
    env.answerWith();

    expectOk(await list({ status: 'draft' }, admin));

    expect(env.asked.filter).toEqual({ status: 'draft' });
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

  it('limit не добирает видимые после отбора: все выбранные невидимы — []', async () => {
    env.answerWith(state('draft', { uuid: U1 }));

    expect(expectOk(await list({ limit: 1 }))).toEqual([]);
  });
});

describe('ListModulesUc — вызывающий и вход', () => {
  it('гость допущен', async () => {
    env.answerWith(state('published'));

    expectOk(await list({}, anonymous));
  });

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    env.answerWith();

    const res = await list({}, system as never);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('authorId не uuid — INPUT_VALIDATION', async () => {
    env.answerWith();

    expectErr(await list({ authorId: 'not-a-uuid' }), 'INPUT_VALIDATION');
  });

  it('limit не число — INPUT_VALIDATION', async () => {
    env.answerWith();

    expectErr(await list({ limit: 'many' as never }), 'INPUT_VALIDATION');
  });
});
