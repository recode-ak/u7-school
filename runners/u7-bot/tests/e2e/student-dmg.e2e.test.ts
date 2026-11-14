import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { LearningController } from '@u7-scl/bot/learning/controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import {
  CompleteStudentUcDef,
  DropStudentUcDef,
  EnrollStudentUcDef,
  MarkAbandonedUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { expectOk, testTrace } from 'dmg-core/testing';
import { CoursesController } from '../../src/controllers/courses/controller';
import { CORE_EDUCATION_WORLD, type WorldDefinition } from '../worlds';

/**
 * E2E событий студента потока на DMG (срез `student`): события публикует UoW
 * модуля `stream` при настоящем UC (`dispatch`), а не публикация legacy-имени
 * `student.*` на шине.
 */

const MENTOR_TG = 1004;
const STUDENT_TG = 1003;

// ── Мир ролей (сценарии P5-44/P5-45) ──

const STREAM2_ID = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
const STREAM0_ID = 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0';
const STEP_S2_ID = 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0';
const STUDENT_ANDREY_S2 = 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0';
const STUDENT_MARINA_S2 = 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1';
const STUDENT_DROPPED_S2 = 'f5f5f5f5-f5f5-f5f5-f5f5-f5f5f5f5f5f5';
const ENROLLING_TG = 1010;
const DROPPING_TG = 1011;
const MARINA_TG = 1007;

/**
 * Мир `core-education` плюс живая запись для самовыхода (`student-dropped`
 * в базовом мире есть только пользователем).
 */
const ROLES_WORLD: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'core-education-roles',
  description: 'Мир ролей: зачисление и снятие студента не меняют роли',
  students: [
    ...(CORE_EDUCATION_WORLD.students ?? []),
    {
      key: 'student-dropped-s2',
      uuid: STUDENT_DROPPED_S2,
      personKey: 'student-dropped',
      streamKey: 'stream-2-active',
      enrolledAt: 'T-15d',
      status: 'active',
      currentStepId: STEP_S2_ID,
      steps: [{ stepId: STEP_S2_ID, status: 'issued', issuedAt: 'T-15d' }],
    },
  ],
};

interface Stand {
  app: TestApp;
  transport: TestBotTransport;
  mentor: U7BotActor;
}

async function createStandWithWorld(
  tag: string,
  world?: WorldDefinition,
): Promise<Stand> {
  const app = await createTestApp(tag, world);
  const transport = createTestBotTransport(app, [
    new StreamsController(),
    new LearningController(),
    new MentorController(),
    new CoursesController(),
  ]);
  const mentor = await app.userByTelegramId(MENTOR_TG);
  return { app, transport, mentor };
}

/**
 * Роль `STUDENT` из модели убрана (роли пользователя — только GUEST,
 * SUBSCRIBER, MENTOR, AUTHOR, ADMIN): доступ к учёбе определяется живой
 * записью студента, а зачисление и снятие роли не выдают и не снимают.
 * Сценарии P5-44/P5-45 сверяют это поведение (осознанное расхождение с
 * v0.2.6, где UC менял роль через `add-role-to-user`/`remove-role-to-user`).
 */
describe('E2E: роли пользователя при зачислении и снятии студента', () => {
  let stand: Stand;

  beforeAll(async () => {
    stand = await createStandWithWorld('student-dmg-roles', ROLES_WORLD);
  });

  afterAll(async () => {
    await stand.app.cleanup();
  });

  async function rolesOf(telegramId: number): Promise<string[]> {
    const actor = await stand.app.userByTelegramId(telegramId);
    return [...actor.user.view().roles];
  }

  test('P5-44: зачисление на поток не добавляет роль STUDENT — роли прежние', async () => {
    const { app } = stand;
    const actor = await app.userByTelegramId(ENROLLING_TG);

    expect(await rolesOf(ENROLLING_TG)).toEqual(['GUEST']);

    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        EnrollStudentUcDef.command({ streamId: STREAM0_ID }),
        actor,
        testTrace(),
      ),
    );

    // Запись студента появилась, роли — те же
    expect(await rolesOf(ENROLLING_TG)).toEqual(['GUEST']);
  });

  test('P5-45: завершение, самовыход и снятие «выбыл» не снимают роль STUDENT — роли прежние', async () => {
    const { app, mentor } = stand;

    // Исход студента ментором: advanced → not_advanced
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CompleteStudentUcDef.command({
          streamId: STREAM2_ID,
          studentId: STUDENT_MARINA_S2,
          outcome: 'not_advanced',
        }),
        mentor,
        testTrace(),
      ),
    );
    expect(await rolesOf(MARINA_TG)).toEqual(['GUEST']);

    // Самовыход студента
    const dropping = await app.userByTelegramId(DROPPING_TG);
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        DropStudentUcDef.command({
          streamId: STREAM2_ID,
          studentId: STUDENT_DROPPED_S2,
        }),
        dropping,
        testTrace(),
      ),
    );
    expect(await rolesOf(DROPPING_TG)).toEqual(['GUEST']);

    // Снятие «выбыл» ментором
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        MarkAbandonedUcDef.command({
          streamId: STREAM2_ID,
          studentId: STUDENT_ANDREY_S2,
          cause: 'inactivity',
        }),
        mentor,
        testTrace(),
      ),
    );
    expect(await rolesOf(STUDENT_TG)).toEqual(['GUEST']);
  });
});
