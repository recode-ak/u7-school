import { beforeEach, describe, expect, it } from 'bun:test';
import {
  type CourseEnrollment,
  CourseModuleDef,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import {
  QuestionnaireModuleDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import {
  CreateCourseWishUcDef,
  findCoursePool,
  WishModuleDef,
  type WishState,
  type WishStatus,
} from '@u7-scl/domain/wish';
import {
  CoreErrors,
  GuestCaller,
  type Identified,
  ok,
  UserCaller,
} from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import {
  expectErr,
  expectOk,
  type StubCall,
  StubFacade,
  testAppContext,
} from 'dmg-core/testing';
import coursePools from '../../../../../domain/src/wish/wish/pools/course.json';
import { WishRepoFake } from '../wish.repo.fake';
import { CreateCourseWishUc } from './create-course-wish.uc';

// Фасады курсов и анкет — `StubFacade` по Def из домена (ARC-06: пакеты
// модулей друг друга не импортируют); случаи «не опубликован» и «без
// стартового модуля» сводятся к `enrollable: false` в `modules/course`.

const START_MODULE = '11111111-1111-4111-8111-111111111111';
const REQ = Trace.fromRequest({ requestId: 'r-1' });

const ACTOR_ID = crypto.randomUUID();
const ACTOR: Identified = { uuid: ACTOR_ID };
const asActor = new UserCaller<Identified>(ACTOR);

const plainCourseId = crypto.randomUUID();
const pooledCourseId = Object.keys(coursePools)[0]!;

let wishes: WishRepoFake;
let course: StubFacade<typeof CourseModuleDef>;
let questionnaire: StubFacade<typeof QuestionnaireModuleDef>;

/** Ответ модуля курсов на запрос о записи. */
const enrollment = (answer: CourseEnrollment) =>
  course.answer(GetCourseEnrollmentUcDef, () => ok(answer));

beforeEach(() => {
  wishes = new WishRepoFake();
  wishes.findAllByUserAndTarget = async () => [];
  course = new StubFacade(CourseModuleDef);
  enrollment({ enrollable: true, startModuleId: START_MODULE });
  questionnaire = new StubFacade(QuestionnaireModuleDef).answer(
    StartQuestionnaireUcDef,
    () => ok({}),
  );
});

/** Что получил фасад: от какой операции, от чьего имени и с каким входом. */
const received = (facade: { readonly received: readonly StubCall[] }) =>
  facade.received.map(({ caller, input }) => ({
    from: caller.from.name,
    person: caller.person(),
    input,
  }));

function makeUc() {
  const { app } = testAppContext();
  const facades = new ModuleFacades([course, questionnaire]);
  return new CreateCourseWishUc({ app, facades, wishes }, WishModuleDef);
}

/**
 * Уже записанное желание актора — запись в памяти, как от прежних сессий;
 * выборка по цели отдаёт его (тест, где цель запроса другая, сбрасывает ответ).
 */
function seed(courseId: string, status: WishStatus): void {
  const at = Date.UTC(2026, 0, 1, 10);
  const state: WishState = {
    uuid: crypto.randomUUID(),
    userId: ACTOR_ID,
    target: { kind: 'course', courseId },
    status,
    createdAt: at,
    updatedAt: at,
    version: 0,
  };
  wishes.seed(state);
  wishes.findAllByUserAndTarget = async () => [
    wishes.restoredOrThrow(state.uuid),
  ];
}

/** Желания актора на курс — то, что реально записано. */
async function storedFor(courseId: string) {
  const found = await wishes.findByUser(ACTOR_ID);
  return found
    .map((wish) => wish.snapshot())
    .filter(
      (s) => s.target.kind === 'course' && s.target.courseId === courseId,
    );
}

describe('CreateCourseWishUc', () => {
  describe('курс без пула — мгновенная фиксация', () => {
    it('создаёт expressed-желание, outcome instant, анкета не вызвана', async () => {
      const res = await makeUc().handle(
        { courseId: plainCourseId },
        asActor,
        REQ,
      );

      expect(expectOk(res)).toEqual({ outcome: 'instant' });
      const stored = await storedFor(plainCourseId);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        userId: ACTOR_ID,
        target: { kind: 'course', courseId: plainCourseId },
        status: 'expressed',
      });
      expect(questionnaire.received).toEqual([]);
    });
  });

  describe('курс с пулом — анкетная ветка', () => {
    it('создаёт pending-желание, запускает анкету с { courseId }, outcome questionnaire', async () => {
      const res = await makeUc().handle(
        { courseId: pooledCourseId },
        asActor,
        REQ,
      );

      expect(expectOk(res)).toEqual({ outcome: 'questionnaire' });
      const stored = await storedFor(pooledCourseId);
      expect(stored).toHaveLength(1);
      expect(stored[0]?.status).toBe('pending');
      expect(received(questionnaire)).toEqual([
        {
          from: CreateCourseWishUcDef.name,
          person: asActor,
          input: {
            pool: findCoursePool(pooledCourseId),
            ownerInfo: { courseId: pooledCourseId },
          },
        },
      ]);
    });

    it('сбой анкеты — ошибка фасада как ответ UC, желание не записано', async () => {
      questionnaire.answer(StartQuestionnaireUcDef, () =>
        CoreErrors.SERVER_INTERNAL.err(),
      );

      const res = await makeUc().handle(
        { courseId: pooledCourseId },
        asActor,
        REQ,
      );

      expectErr(res, 'SERVER_INTERNAL');
      expect(await storedFor(pooledCourseId)).toEqual([]);
    });
  });

  describe('конфликт', () => {
    it.each(['expressed', 'pending', 'confirmed'] as const)(
      'WISH_ALREADY_EXISTS при активном желании в статусе %s',
      async (status) => {
        seed(plainCourseId, status);

        const res = await makeUc().handle(
          { courseId: plainCourseId },
          asActor,
          REQ,
        );

        const error = expectErr(res, 'WISH_ALREADY_EXISTS');
        expect(error.kind).toBe('conflict');
        expect(error.payload).toEqual({
          userId: ACTOR_ID,
          courseId: plainCourseId,
          status,
        });
        expect(await storedFor(plainCourseId)).toHaveLength(1);
      },
    );

    it('активное желание на другой курс не блокирует', async () => {
      seed(crypto.randomUUID(), 'confirmed');
      // Выборка по цели запроса (другой курс) активного желания не находит.
      wishes.findAllByUserAndTarget = async () => [];

      const res = await makeUc().handle(
        { courseId: plainCourseId },
        asActor,
        REQ,
      );

      expect(expectOk(res)).toEqual({ outcome: 'instant' });
    });
  });

  describe('курс недоступен для записи', () => {
    it('enrollable: false → WISH_COURSE_NOT_FOUND, ничего не записано', async () => {
      enrollment({ enrollable: false });

      const res = await makeUc().handle(
        { courseId: plainCourseId },
        asActor,
        REQ,
      );

      const error = expectErr(res, 'WISH_COURSE_NOT_FOUND');
      expect(error.kind).toBe('not_found');
      expect(error.payload).toEqual({ courseId: plainCourseId });
      expect(await storedFor(plainCourseId)).toEqual([]);
      expect(questionnaire.received).toEqual([]);
    });

    it('сначала курс, затем дубль: при недоступном курсе — WISH_COURSE_NOT_FOUND', async () => {
      seed(plainCourseId, 'expressed');
      enrollment({ enrollable: false });

      const res = await makeUc().handle(
        { courseId: plainCourseId },
        asActor,
        REQ,
      );

      expectErr(res, 'WISH_COURSE_NOT_FOUND');
    });

    it('курс спрашивается через фасад от имени UC и вызывающего', async () => {
      await makeUc().handle({ courseId: plainCourseId }, asActor, REQ);

      expect(received(course)).toEqual([
        {
          from: CreateCourseWishUcDef.name,
          person: asActor,
          input: { courseId: plainCourseId },
        },
      ]);
    });

    it('сбой фасада курсов — ошибка как есть, ничего не записано', async () => {
      course.answer(GetCourseEnrollmentUcDef, () =>
        CoreErrors.SERVER_INTERNAL.err(),
      );

      const res = await makeUc().handle(
        { courseId: plainCourseId },
        asActor,
        REQ,
      );

      expectErr(res, 'SERVER_INTERNAL');
      expect(await storedFor(plainCourseId)).toEqual([]);
    });
  });

  it('вызывающий guest — UNAUTHORIZED, ничего не записано', async () => {
    const res = await makeUc().handle(
      { courseId: plainCourseId },
      new GuestCaller(),
      REQ,
    );

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
    expect(await storedFor(plainCourseId)).toEqual([]);
  });
});
