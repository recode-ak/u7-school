import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CourseModuleDef,
  GetCoursesStartingWithModuleUcDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import {
  GetStreamPresenceUcDef,
  StreamEvents,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import {
  GetTelegramAddressesUcDef,
  UserModuleDef,
} from '@u7-scl/domain/user/contract';
import {
  WishEvents,
  WishModuleDef,
  type WishState,
  type WishStatus,
  type WishTargetVo,
} from '@u7-scl/domain/wish';
import { CoreErrors, ok } from 'dmg-core';
import { type EnvelopeOf, ModuleFacades } from 'dmg-core/app';
import {
  expectErr,
  expectIdempotentReaction,
  expectOk,
  MemoryBus,
  StubFacade,
  TEST_NOW,
  testAppContext,
} from 'dmg-core/testing';
import { WishJsonRepo } from '../../infra/wish.json-repo';
import { trackHandling } from './er.fixture';
import { InviteWishersEr } from './invite-wishers.er';

// Перенос случаев legacy `api/er/invite-wishers-er.test.ts` на ER по Def.
// Фасады курсов, потоков и пользователей — `StubFacade` по Def из домена
// (ARC-06). «Стартовый ли модуль» и историческую идентичность решает модуль
// курсов — здесь его ответы.

const STREAM = '11111111-1111-4111-8111-111111111111';
const MODULE = '33333333-3333-4333-8333-333333333333';
const OTHER_MODULE = '99999999-9999-4999-8999-999999999999';
const USER = '22222222-2222-4222-8222-222222222222';
const OTHER_USER = '77777777-7777-4777-8777-777777777777';
const COURSE = '44444444-4444-4444-8444-444444444444';
const FORK = '55555555-5555-4555-8555-555555555555';
const CREATED = Date.UTC(2025, 7, 20, 10);
const TELEGRAM = 777;

let dir: string;
let file: string;
let wishes: WishJsonRepo;
let course: StubFacade<typeof CourseModuleDef>;
let streams: StubFacade<typeof StreamModuleDef>;
let users: StubFacade<typeof UserModuleDef>;
let ctx: ReturnType<typeof testAppContext>;

/** Ответы курсов: какие курсы начинаются с модуля; модули — по равенству id. */
function courseAnswers(startingCourseIds: string[]) {
  course
    .answer(GetCoursesStartingWithModuleUcDef, ({ courseIds }) =>
      ok({
        courseIds: courseIds.filter((id) => startingCourseIds.includes(id)),
      }),
    )
    .answer(GetSameModulesUcDef, ({ moduleId, moduleIds }) =>
      ok({ moduleIds: moduleIds.filter((id) => id === moduleId) }),
    );
}

/** Ответ потоков: поток есть/нет. */
const streamExists = (exists: boolean) =>
  streams.answer(GetStreamPresenceUcDef, () => ok({ exists }));

/** Ответ пользователей: адреса есть только у перечисленных. */
const addressed = (...userIds: string[]) =>
  users.answer(GetTelegramAddressesUcDef, (input) =>
    ok({
      addresses: input.userIds
        .filter((id) => userIds.includes(id))
        .map((userId) => ({ userId, telegramId: TELEGRAM })),
    }),
  );

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'invite-wishers-'));
  file = join(dir, 'wishes.json');
  wishes = new WishJsonRepo(file);
  course = new StubFacade(CourseModuleDef);
  streams = new StubFacade(StreamModuleDef);
  users = new StubFacade(UserModuleDef);
  courseAnswers([]);
  streamExists(true);
  addressed(USER);
  ctx = testAppContext();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeEr() {
  const facades = new ModuleFacades([course, streams, users]);
  return new InviteWishersEr({ app: ctx.app, facades, wishes }, WishModuleDef);
}

function created(moduleId = MODULE): EnvelopeOf<typeof StreamEvents.created> {
  const payload = { streamId: STREAM, moduleId };
  return {
    ...StreamEvents.created.make(payload),
    eventId: crypto.randomUUID(),
    occurredAt: TEST_NOW,
    aggregateId: STREAM,
    cause: { kind: 'request', requestId: 'r-1' },
    correlationId: 'c-1',
  };
}

function wish(
  status: WishStatus,
  target: WishTargetVo,
  userId = USER,
): WishState {
  return {
    uuid: crypto.randomUUID(),
    userId,
    target,
    status,
    createdAt: CREATED,
    updatedAt: CREATED,
    version: 0,
  };
}
const courseWish = (status: WishStatus, courseId = COURSE, userId = USER) =>
  wish(status, { kind: 'course', courseId }, userId);
const moduleWish = (status: WishStatus, moduleId = MODULE, userId = USER) =>
  wish(status, { kind: 'module', moduleId }, userId);

/** Желания, как от прежних сессий, — запись в файл. */
async function seed(...states: WishState[]): Promise<void> {
  await Bun.write(file, JSON.stringify(states));
}

/** Что спросили у других модулей: UC и вход, по порядку. */
const asked = () =>
  [course, streams, users].flatMap((f) =>
    f.received.map(({ def, input }) => ({ uc: def.name, input })),
  );

const warnings = () => ctx.logs.filter((l) => l.level === 'warn');

describe('InviteWishersEr — course-желания', () => {
  it('курс начинается с модуля потока — публикуется wish.invited с адресацией', async () => {
    const w = courseWish('expressed');
    await seed(w);
    courseAnswers([COURSE]);

    expectOk(await makeEr().handle(created()));

    expect(ctx.published).toHaveLength(1);
    expect(ctx.published[0]).toMatchObject({
      name: WishEvents.invited.name,
      aggregateId: w.uuid,
      payload: {
        userId: USER,
        telegramId: TELEGRAM,
        streamId: STREAM,
        targetKind: 'course',
        courseId: COURSE,
      },
    });
  });

  it('исторический матчинг: желание на форк курса получает приглашение', async () => {
    const fork = courseWish('expressed', FORK);
    await seed(fork);
    courseAnswers([FORK]);

    expectOk(await makeEr().handle(created()));

    expect(ctx.published).toHaveLength(1);
    expect(ctx.published[0]).toMatchObject({
      aggregateId: fork.uuid,
      payload: { targetKind: 'course', courseId: FORK },
    });
  });

  it.each([
    ['курс не начинается с модуля', () => courseWish('expressed')],
    ['другой модуль', () => moduleWish('expressed', OTHER_MODULE)],
  ])('цель не совпала: %s — желание не зовётся', async (_, make) => {
    await seed(make());

    expectOk(await makeEr().handle(created()));

    expect(ctx.published).toEqual([]);
    expect(streams.received).toEqual([]);
    expect(users.received).toEqual([]);
  });
});

describe('InviteWishersEr — module-желания', () => {
  it('поток на любой модуль: тот же модуль приглашается; спрошен getSameModules', async () => {
    const w = moduleWish('expressed');
    await seed(w);

    expectOk(await makeEr().handle(created()));

    expect(asked()[0]).toEqual({
      uc: 'getSameModules',
      input: { moduleId: MODULE, moduleIds: [MODULE] },
    });
    expect(ctx.published).toHaveLength(1);
    expect(ctx.published[0]).toMatchObject({
      aggregateId: w.uuid,
      payload: {
        userId: USER,
        telegramId: TELEGRAM,
        streamId: STREAM,
        targetKind: 'module',
        moduleId: MODULE,
      },
    });
  });

  it('смешанные желания: course и module приглашаются независимо, один батч на вид', async () => {
    await seed(courseWish('expressed'), moduleWish('confirmed'));
    courseAnswers([COURSE]);

    expectOk(await makeEr().handle(created()));

    expect(ctx.published).toHaveLength(2);
    expect(
      asked()
        .map(({ uc }) => uc)
        .sort(),
    ).toEqual([
      'getCoursesStartingWithModule',
      'getSameModules',
      'getStreamPresence',
      'getTelegramAddresses',
    ]);
  });
});

describe('InviteWishersEr — кого приглашать', () => {
  it('желаний нет — никто не спрашивается, событий нет', async () => {
    expectOk(await makeEr().handle(created()));
    expect(asked()).toEqual([]);
    expect(ctx.published).toEqual([]);
  });

  it('несколько совпавших желаний — событие каждому, один вызов потока и адресов', async () => {
    await seed(
      moduleWish('expressed', MODULE, USER),
      moduleWish('confirmed', MODULE, OTHER_USER),
    );
    addressed(USER, OTHER_USER);

    expectOk(await makeEr().handle(created()));

    expect(ctx.published).toHaveLength(2);
    expect(asked().filter((a) => a.uc === 'getStreamPresence')).toHaveLength(1);
    expect(asked().filter((a) => a.uc === 'getTelegramAddresses')).toEqual([
      {
        uc: 'getTelegramAddresses',
        input: { userIds: [USER, OTHER_USER] },
      },
    ]);
  });
});

describe('InviteWishersEr — поток и адресаты', () => {
  it('поток не найден — событий нет, без ошибки и без предупреждения', async () => {
    await seed(moduleWish('expressed'));
    streamExists(false);

    expectOk(await makeEr().handle(created()));

    expect(ctx.published).toEqual([]);
    expect(warnings()).toEqual([]);
  });

  it('у адресата нет telegramId — пропуск с предупреждением, остальные приглашены', async () => {
    const reachable = moduleWish('expressed', MODULE, USER);
    await seed(reachable, moduleWish('expressed', MODULE, OTHER_USER));

    expectOk(await makeEr().handle(created()));

    expect(ctx.published.map((e) => e.aggregateId)).toEqual([reachable.uuid]);
    expect(warnings()).toEqual([
      expect.objectContaining({
        source: 'inviteWishers',
        message: expect.stringContaining(OTHER_USER),
      }),
    ]);
  });

  it('пользователь с несколькими желаниями без адреса — одно предупреждение', async () => {
    await seed(
      moduleWish('expressed', MODULE, OTHER_USER),
      courseWish('expressed', COURSE, OTHER_USER),
    );
    courseAnswers([COURSE]);

    expectOk(await makeEr().handle(created()));

    expect(ctx.published).toEqual([]);
    expect(warnings()).toHaveLength(1);
  });
});

describe('InviteWishersEr — отказ других модулей', () => {
  it('отказ курсов → ошибка, ничего не опубликовано, лог и запись в oplog', async () => {
    await seed(moduleWish('expressed'));
    course.answer(GetSameModulesUcDef, () => CoreErrors.SERVER_INTERNAL.err());

    const error = expectErr(
      await makeEr().handle(created()),
      'SERVER_INTERNAL',
    );

    expect(ctx.published).toEqual([]);
    expect(ctx.logs).toContainEqual(
      expect.objectContaining({ level: 'error', source: 'inviteWishers' }),
    );
    expect(ctx.oplog.records).toEqual([
      expect.objectContaining({
        module: 'wish',
        op: 'inviteWishers',
        kind: 'eventReaction',
        result: { ok: false, error },
      }),
    ]);
  });

  it('сбой потоков (исключение) → SERVER_INTERNAL, ничего не опубликовано', async () => {
    await seed(moduleWish('expressed'));
    streams.answer(GetStreamPresenceUcDef, () => {
      throw new Error('потоки недоступны');
    });

    expectErr(await makeEr().handle(created()), 'SERVER_INTERNAL');

    expect(ctx.published).toEqual([]);
  });

  it('отказ пользователей → ошибка, ничего не опубликовано', async () => {
    await seed(moduleWish('expressed'));
    users.answer(GetTelegramAddressesUcDef, () =>
      CoreErrors.SERVER_INTERNAL.err(),
    );

    expectErr(await makeEr().handle(created()), 'SERVER_INTERNAL');

    expect(ctx.published).toEqual([]);
  });
});

describe('InviteWishersEr.subscribe', () => {
  it('реагирует на stream.stream.created из шины', async () => {
    await seed(moduleWish('expressed'));
    const bus = new MemoryBus();
    const er = makeEr();
    const handled = trackHandling(er);
    er.subscribe(bus);

    bus.publish(created());
    await handled();

    expect(ctx.published).toHaveLength(1);
  });
});

describe('InviteWishersEr — идемпотентность (D-47)', () => {
  // Желание помнит приглашённые потоки (`invitedStreamIds`),
  // повторное stream.created (новый eventId) не публикует wish.invited.
  it('повтор stream.created с новым eventId — Ok, хранилище и события не меняются', async () => {
    await seed(moduleWish('expressed'));
    const er = makeEr();
    await expect(
      expectIdempotentReaction({
        event: created(),
        deliver: (event) => er.handle(event),
        published: ctx.published,
        state: () => Bun.file(file).text(),
      }),
    ).resolves.toBeUndefined();
  });
});
