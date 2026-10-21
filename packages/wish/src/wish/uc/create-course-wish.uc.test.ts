import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Role, type User } from '@u7-scl/app/domain';
import {
  type CourseEnrollment,
  type CourseModuleFacade,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import {
  type QuestionnaireModuleFacade,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import {
  CreateCourseWishUcDef,
  findCoursePool,
  type WishState,
  type WishStatus,
} from '@u7-scl/domain/wish';
import { type CallContext, type Caller, CoreErrors, ok } from 'dmg-core';
import { requestTrace } from 'dmg-core/app';
import {
  expectErr,
  expectOk,
  fakeFacadeCall,
  testAppContext,
} from 'dmg-core/testing';
import coursePools from '../../../../domain/src/wish/wish/pools/course.json';
import { WishJsonRepo } from '../../infra/wish.json-repo';
import { CreateCourseWishUc } from './create-course-wish.uc';

// Перенос случаев legacy `api/wish/create-course-wish-uc.test.ts` на UC по
// Def. Фасады курсов и анкет — фейки типов D-42 из домена (ARC-06: пакеты
// модулей друг друга не импортируют); ответы legacy-фасадов («не
// опубликован», «без стартового модуля») сводит к `enrollable: false`
// адаптер TR-11 — эти случаи проверяет `packages/course` (Ф8 шаг 2b).

const START_MODULE = '11111111-1111-4111-8111-111111111111';
const REQ = requestTrace({ requestId: 'r-1' });

const ACTOR_ID = crypto.randomUUID();
const ACTOR: User = {
  uuid: ACTOR_ID,
  name: 'Актор',
  telegramId: 1,
  roles: [Role.STUDENT],
  createdAt: '2026-01-01T00:00',
};
const asActor: Caller<User> = { kind: 'user', user: ACTOR };

const plainCourseId = crypto.randomUUID();
const pooledCourseId = Object.keys(coursePools)[0]!;

/** Что фасад получил: от чьего имени и с какими аргументами. */
type Called = { readonly from: string; readonly caller: unknown };

let dir: string;
let file: string;
let wishes: WishJsonRepo;
let enrollment: CourseEnrollment;
let courseFails: boolean;
let startFails: boolean;
let courseCalls: (Called & { readonly courseId: string })[];
let startCalls: (Called & {
  readonly pool: unknown;
  readonly owner: unknown;
})[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'create-course-wish-'));
  file = join(dir, 'wishes.json');
  wishes = new WishJsonRepo(file);
  enrollment = { enrollable: true, startModuleId: START_MODULE };
  courseFails = false;
  startFails = false;
  courseCalls = [];
  startCalls = [];
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const called = (call: CallContext): Called => ({
  from: call.from.name,
  caller: call.caller,
});

const course: CourseModuleFacade = {
  getCourseEnrollment: fakeFacadeCall(
    GetCourseEnrollmentUcDef,
    (call, courseId: string) => {
      courseCalls.push({ ...called(call), courseId });
      return courseFails ? CoreErrors.SERVER_INTERNAL.err() : ok(enrollment);
    },
  ),
};

const questionnaire: QuestionnaireModuleFacade = {
  startQuestionnaire: fakeFacadeCall(
    StartQuestionnaireUcDef,
    (call, pool: unknown, owner: unknown) => {
      if (startFails) return CoreErrors.SERVER_INTERNAL.err();
      startCalls.push({ ...called(call), pool, owner });
      return ok({});
    },
  ),
};

function makeUc() {
  const { app } = testAppContext();
  return new CreateCourseWishUc({ app, wishes, course, questionnaire });
}

/** UC, чей Def без вызываемого UC в `calls` (подмена `from`, Def не правится). */
function makeUcWithout(removed: unknown) {
  const uc = makeUc();
  const def = {
    ...CreateCourseWishUcDef,
    calls: CreateCourseWishUcDef.calls?.filter((c) => c !== removed),
  };
  Object.defineProperty(uc, 'def', { value: def });
  return uc;
}

/** Уже записанное желание актора — запись в файл, как от прежних сессий. */
async function seed(courseId: string, status: WishStatus): Promise<void> {
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
  await Bun.write(file, JSON.stringify([state]));
}

/** Желания актора на курс — то, что реально записано. */
async function storedFor(courseId: string) {
  const found = await wishes.findAllByUserAndTarget(ACTOR_ID, {
    kind: 'course',
    courseId,
  });
  return found.map((wish) => wish.snapshot());
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
      expect(startCalls).toEqual([]);
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
      expect(startCalls).toEqual([
        {
          from: CreateCourseWishUcDef.name,
          caller: asActor,
          pool: findCoursePool(pooledCourseId),
          owner: { courseId: pooledCourseId },
        },
      ]);
    });

    it('сбой анкеты — ошибка фасада как ответ UC, желание не записано', async () => {
      startFails = true;

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
        await seed(plainCourseId, status);

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

    it('дубль — текст прежний', async () => {
      await seed(plainCourseId, 'expressed');

      const res = await makeUc().handle(
        { courseId: plainCourseId },
        asActor,
        REQ,
      );

      expect(expectErr(res, 'WISH_ALREADY_EXISTS').label).toBe(
        'Желание уже выражено',
      );
    });

    it.each(['cancelled', 'fulfilled', 'abandoned'] as const)(
      'повторное желание после %s разрешено',
      async (status) => {
        await seed(plainCourseId, status);

        const res = await makeUc().handle(
          { courseId: plainCourseId },
          asActor,
          REQ,
        );

        expect(expectOk(res)).toEqual({ outcome: 'instant' });
        expect(await storedFor(plainCourseId)).toHaveLength(2);
      },
    );

    it('активное желание на другой курс не блокирует', async () => {
      await seed(crypto.randomUUID(), 'confirmed');

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
      enrollment = { enrollable: false };

      const res = await makeUc().handle(
        { courseId: plainCourseId },
        asActor,
        REQ,
      );

      const error = expectErr(res, 'WISH_COURSE_NOT_FOUND');
      expect(error.kind).toBe('not_found');
      expect(error.label).toBe('Курс не найден');
      expect(error.payload).toEqual({ courseId: plainCourseId });
      expect(await storedFor(plainCourseId)).toEqual([]);
      expect(startCalls).toEqual([]);
    });

    it('сначала курс, затем дубль: при недоступном курсе — WISH_COURSE_NOT_FOUND', async () => {
      await seed(plainCourseId, 'expressed');
      enrollment = { enrollable: false };

      const res = await makeUc().handle(
        { courseId: plainCourseId },
        asActor,
        REQ,
      );

      expectErr(res, 'WISH_COURSE_NOT_FOUND');
    });

    it('курс спрашивается через фасад от имени UC и вызывающего', async () => {
      await makeUc().handle({ courseId: plainCourseId }, asActor, REQ);

      expect(courseCalls).toEqual([
        {
          from: CreateCourseWishUcDef.name,
          caller: asActor,
          courseId: plainCourseId,
        },
      ]);
    });

    it('сбой фасада курсов — ошибка как есть, ничего не записано', async () => {
      courseFails = true;

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
      { kind: 'guest' },
      REQ,
    );

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
    expect(await storedFor(plainCourseId)).toEqual([]);
  });

  describe('Def не объявляет вызываемый UC в calls', () => {
    it('нет getCourseEnrollment → UNAUTHORIZED, ничего не записано', async () => {
      const res = await makeUcWithout(GetCourseEnrollmentUcDef).handle(
        { courseId: plainCourseId },
        asActor,
        REQ,
      );

      expectErr(res, 'UNAUTHORIZED');
      expect(courseCalls).toEqual([]);
      expect(await storedFor(plainCourseId)).toEqual([]);
    });

    it('нет startQuestionnaire → UNAUTHORIZED, желание не записано', async () => {
      const res = await makeUcWithout(StartQuestionnaireUcDef).handle(
        { courseId: pooledCourseId },
        asActor,
        REQ,
      );

      expectErr(res, 'UNAUTHORIZED');
      expect(startCalls).toEqual([]);
      expect(await storedFor(pooledCourseId)).toEqual([]);
    });
  });
});
