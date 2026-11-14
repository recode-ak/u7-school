import { describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import {
  QuestionnaireModuleDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import { CreateCourseWishUcDef } from '@u7-scl/domain/wish';
import { type Identified, ok, UserCaller } from 'dmg-core';
import { ModuleFacades } from 'dmg-core/app';
import {
  expectOk,
  StubFacade,
  TEST_TRACE,
  testAppContext,
} from 'dmg-core/testing';
import { WishRepoFake } from './wish/wish.repo.fake';
import { createWishModule } from './wish.module';

const ACTOR: Identified = { uuid: crypto.randomUUID() };

/**
 * Модуль на фейке репозитория (диск проверяет контрактный тест infra);
 * фасады зависимостей — `StubFacade` по Def (ARC-06).
 */
function makeModule() {
  const { app } = testAppContext();
  const wishes = new WishRepoFake();
  wishes.findAllByUserAndTarget = async () => [];
  const course = new StubFacade(CourseModuleDef).answer(
    GetCourseEnrollmentUcDef,
    () =>
      ok({
        enrollable: true,
        startModuleId: '11111111-1111-4111-8111-111111111111',
      }),
  );
  const questionnaire = new StubFacade(QuestionnaireModuleDef).answer(
    StartQuestionnaireUcDef,
    () => ok({}),
  );
  const facades = new ModuleFacades([course, questionnaire]);
  const module = createWishModule({ app, facades, wishes });
  return { module, wishes };
}

describe('createWishModule', () => {
  it('smoke: createCourseWish через модуль пишет желание в репозиторий', async () => {
    const { module, wishes } = makeModule();
    const courseId = crypto.randomUUID();

    const res = await module.dispatch(
      CreateCourseWishUcDef.command({ courseId }),
      new UserCaller(ACTOR),
      TEST_TRACE,
    );

    expect(expectOk(res)).toEqual({ outcome: 'instant' });
    const stored = await wishes.findByUser(ACTOR.uuid);
    expect(stored.map((w) => w.snapshot().target)).toEqual([
      { kind: 'course', courseId },
    ]);
  });
});
