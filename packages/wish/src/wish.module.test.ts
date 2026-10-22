import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Role, type User } from '@u7-scl/app/domain';
import {
  CourseModuleDef,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import {
  QuestionnaireModuleDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import { CreateCourseWishUcDef } from '@u7-scl/domain/wish';
import { ok, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, StubFacade, testAppContext } from 'dmg-core/testing';
import { WishJsonRepo } from './infra/wish.json-repo';
import { createWishModule } from './wish.module';

const ACTOR: User = {
  uuid: crypto.randomUUID(),
  name: 'Актор',
  telegramId: 1,
  roles: [Role.STUDENT],
  createdAt: '2026-01-01T00:00',
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wish-module-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

// Фасады зависимостей — `StubFacade` по Def (ARC-06); репозиторий настоящий.
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

/** Модуль на настоящем репозитории во временном каталоге. */
function makeModule() {
  const { app } = testAppContext();
  const wishes = new WishJsonRepo(join(dir, 'wishes.json'));
  const facades = new ModuleFacades([course, questionnaire]);
  const module = createWishModule({ app, facades, wishes });
  return { module, wishes };
}

describe('createWishModule', () => {
  it('собирает модуль по карте Def', () => {
    expect(makeModule().module.def.name).toBe('wish');
  });

  it('smoke: createCourseWish через модуль пишет желание в репозиторий', async () => {
    const { module, wishes } = makeModule();
    const courseId = crypto.randomUUID();

    const res = await module.handle(
      CreateCourseWishUcDef,
      { courseId },
      new UserCaller(ACTOR),
      Trace.fromRequest({ requestId: 'r-1' }),
    );

    expect(expectOk(res)).toEqual({ outcome: 'instant' });
    const stored = await wishes.findByUser(ACTOR.uuid);
    expect(stored.map((w) => w.snapshot().target)).toEqual([
      { kind: 'course', courseId },
    ]);
  });
});
