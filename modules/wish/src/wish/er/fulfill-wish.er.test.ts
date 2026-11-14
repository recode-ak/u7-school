import { beforeEach, describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  GetCoursesIncludingModuleUcDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import { StudentEvents } from '@u7-scl/domain/stream/contract';
import {
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
import { WishRepoFake } from '../wish.repo.fake';
import { trackHandling } from './er.fixture';
import { FulfillWishEr } from './fulfill-wish.er';

// Фасад курсов — `StubFacade` по Def из домена (ARC-06); историческую
// идентичность курсов и модулей решает модуль курсов — здесь его ответы.

const MODULE = '33333333-3333-4333-8333-333333333333';
const OTHER_MODULE = '99999999-9999-4999-8999-999999999999';
const USER = '22222222-2222-4222-8222-222222222222';
const COURSE = '44444444-4444-4444-8444-444444444444';
const FORK = '55555555-5555-4555-8555-555555555555';
const CREATED = Date.UTC(2025, 7, 20, 10);

let wishes: WishRepoFake;
let course: StubFacade<typeof CourseModuleDef>;
let ctx: ReturnType<typeof testAppContext>;

/** Ответы модуля курсов: какие курсы включают модуль; модули — по равенству id. */
function courseAnswers(includedCourseIds: string[]) {
  course
    .answer(GetCoursesIncludingModuleUcDef, ({ courseIds }) =>
      ok({
        courseIds: courseIds.filter((id) => includedCourseIds.includes(id)),
      }),
    )
    .answer(GetSameModulesUcDef, ({ moduleId, moduleIds }) =>
      ok({ moduleIds: moduleIds.filter((id) => id === moduleId) }),
    );
}

beforeEach(() => {
  wishes = new WishRepoFake();
  course = new StubFacade(CourseModuleDef);
  courseAnswers([]);
  ctx = testAppContext();
});

function makeEr() {
  const facades = new ModuleFacades([course]);
  return new FulfillWishEr({ app: ctx.app, facades, wishes }, WishModuleDef);
}

function enrolled(): EnvelopeOf<typeof StudentEvents.enrolled> {
  const payload = {
    studentId: crypto.randomUUID(),
    userId: USER,
    streamId: crypto.randomUUID(),
    moduleId: MODULE,
  };
  return {
    ...StudentEvents.enrolled.make(payload),
    eventId: crypto.randomUUID(),
    occurredAt: TEST_NOW,
    aggregateId: payload.studentId,
    cause: { kind: 'request', requestId: 'r-1' },
    correlationId: 'c-1',
  };
}

function wish(status: WishStatus, target: WishTargetVo): WishState {
  return {
    uuid: crypto.randomUUID(),
    userId: USER,
    target,
    status,
    createdAt: CREATED,
    updatedAt: CREATED,
    version: 0,
  };
}
const courseWish = (status: WishStatus, courseId = COURSE) =>
  wish(status, { kind: 'course', courseId });
const moduleWish = (status: WishStatus, moduleId = MODULE) =>
  wish(status, { kind: 'module', moduleId });

/** Желания, как от прежних сессий, — запись в файл. */
function seed(...states: WishState[]): void {
  wishes.seed(...states);
}

/** Статусы записанных желаний по uuid. */
async function statuses(): Promise<Record<string, WishStatus>> {
  const stored = await wishes.findByUser(USER);
  return Object.fromEntries(
    stored.map((w) => [w.snapshot().uuid, w.snapshot().status]),
  );
}

/** Что спросили у курса: UC и вход, по порядку. */
const asked = () =>
  course.received.map(({ def, input }) => ({ uc: def.name, input }));

describe('FulfillWishEr — course-желания', () => {
  it.each(['expressed', 'confirmed'] as const)(
    '%s → fulfilled на момент часов приложения',
    async (status) => {
      const w = courseWish(status);
      seed(w);
      courseAnswers([COURSE]);

      expectOk(await makeEr().handle(enrolled()));

      const [stored] = await wishes.findByUser(USER);
      expect(stored?.snapshot()).toMatchObject({
        uuid: w.uuid,
        status: 'fulfilled',
        updatedAt: TEST_NOW,
      });
    },
  );

  it('один батч-вызов курса с курсами всех кандидатов, модули не спрашиваются', async () => {
    const a = courseWish('expressed', COURSE);
    const b = courseWish('confirmed', FORK);
    seed(a, b);
    courseAnswers([COURSE, FORK]);

    expectOk(await makeEr().handle(enrolled()));

    expect(asked()).toEqual([
      {
        uc: 'getCoursesIncludingModule',
        input: { moduleId: MODULE, courseIds: [COURSE, FORK] },
      },
    ]);
    // Курсы одной форк-семьи — реализуются все.
    expect(await statuses()).toEqual({
      [a.uuid]: 'fulfilled',
      [b.uuid]: 'fulfilled',
    });
  });

  it('курс не включает модуль — желание не меняется', async () => {
    const w = courseWish('expressed');
    seed(w);

    expectOk(await makeEr().handle(enrolled()));

    expect(await statuses()).toEqual({ [w.uuid]: 'expressed' });
  });
});

describe('FulfillWishEr — module-желания', () => {
  it('тот же модуль → fulfilled; спрошен getSameModules, курсы — нет', async () => {
    const w = moduleWish('expressed');
    seed(w);

    expectOk(await makeEr().handle(enrolled()));

    expect(asked()).toEqual([
      {
        uc: 'getSameModules',
        input: { moduleId: MODULE, moduleIds: [MODULE] },
      },
    ]);
    expect(await statuses()).toEqual({ [w.uuid]: 'fulfilled' });
  });

  it('другой модуль — желание не меняется', async () => {
    const w = moduleWish('confirmed', OTHER_MODULE);
    seed(w);

    expectOk(await makeEr().handle(enrolled()));

    expect(await statuses()).toEqual({ [w.uuid]: 'confirmed' });
  });

  it('смешанные желания: course и module реализуются независимо', async () => {
    const c = courseWish('expressed');
    const m = moduleWish('expressed');
    seed(c, m);
    courseAnswers([COURSE]);

    expectOk(await makeEr().handle(enrolled()));

    expect(asked().map(({ uc }) => uc)).toEqual([
      'getCoursesIncludingModule',
      'getSameModules',
    ]);
    expect(await statuses()).toEqual({
      [c.uuid]: 'fulfilled',
      [m.uuid]: 'fulfilled',
    });
  });
});

describe('FulfillWishEr — нереализуемые желания и идемпотентность', () => {
  it('желаний нет — курс не спрашивается', async () => {
    expectOk(await makeEr().handle(enrolled()));
    expect(course.received).toEqual([]);
  });
});

/** Два желания (course и module); курс отвечает на модули отказом. */
function seedWithModuleRefusal(): void {
  seed(courseWish('expressed'), moduleWish('expressed'));
  courseAnswers([COURSE]);
  course.answer(GetSameModulesUcDef, () => CoreErrors.SERVER_INTERNAL.err());
}

/** Запись oplog о реакции, завершившейся ошибкой. */
const failedRecord = (error: unknown) =>
  expect.objectContaining({
    module: 'wish',
    op: 'fulfillWish',
    kind: 'eventReaction',
    result: { ok: false, error },
  });

describe('FulfillWishEr — отказ курса', () => {
  it('отказ вызова → ошибка, ничего не записано, лог и запись в oplog', async () => {
    seedWithModuleRefusal();

    const error = expectErr(
      await makeEr().handle(enrolled()),
      'SERVER_INTERNAL',
    );

    expect(wishes.saved).toEqual([]);
    expect(ctx.logs).toContainEqual(
      expect.objectContaining({ level: 'error', source: 'fulfillWish' }),
    );
    expect(ctx.oplog.records).toEqual([failedRecord(error)]);
  });

  it('сбой вызова (исключение) → SERVER_INTERNAL, ничего не записано', async () => {
    seed(courseWish('expressed'));
    course.answer(GetCoursesIncludingModuleUcDef, () => {
      throw new Error('курсы недоступны');
    });

    expectErr(await makeEr().handle(enrolled()), 'SERVER_INTERNAL');

    expect(wishes.saved).toEqual([]);
    expect(ctx.logs.map((l) => l.level)).toEqual(['error']);
  });
});

describe('FulfillWishEr.subscribe', () => {
  it('реагирует на stream.student.enrolled из шины', async () => {
    const w = courseWish('expressed');
    seed(w);
    courseAnswers([COURSE]);
    const bus = new MemoryBus();
    const er = makeEr();
    const handled = trackHandling(er);
    er.subscribe(bus);

    bus.publish(enrolled());
    await handled();

    expect(await statuses()).toEqual({ [w.uuid]: 'fulfilled' });
  });
});

describe('FulfillWishEr — идемпотентность (D-47)', () => {
  it('повтор stream.student.enrolled с новым eventId — без записей и событий', async () => {
    seed(courseWish('expressed'), moduleWish('confirmed'));
    courseAnswers([COURSE]);
    const er = makeEr();
    await expectIdempotentReaction({
      event: enrolled(),
      deliver: (event) => er.handle(event),
      published: ctx.published,
      state: () => structuredClone(wishes.saved),
    });
  });
});
