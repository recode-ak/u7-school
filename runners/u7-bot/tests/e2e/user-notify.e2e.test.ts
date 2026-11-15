import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { LearningController } from '@u7-scl/bot/learning/controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { md } from '@u7-scl/core/shared';
import {
  ActivateStreamUcDef,
  CompleteStudentUcDef,
  CreateStreamUcDef,
  EnrollStudentUcDef,
  GetStudentByUserUcDef,
  StreamModuleDef,
  StudentEvents,
} from '@u7-scl/domain/stream/contract';
import {
  CreateCourseWishUcDef,
  WishModuleDef,
} from '@u7-scl/domain/wish/contract';
import { envelopeOf } from '@u7-scl/test-helpers/envelope-of';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import type { AnyEventDef } from 'dmg-core';
import { expectOk, testTrace } from 'dmg-core/testing';
import * as v from 'valibot';
import { CoursesController } from '../../src/controllers/courses/controller';

/**
 * E2E механизма уведомлений:
 *   1) открытие набора → желающий получает ОДНО кнопочное приглашение
 *      с контекстом (курс, поток, дата, ментор) — ER invite-wishers
 *      публикует wish.wish.invited, карточку рендерит WishInviteStory
 *      (канал invite), FR-6 #8;
 *   2) закрытие потока на последнем модуле → студенту «🎉 Курс завершён!»
 *      — UC complete-student, FR-6 #7c;
 *   3) закрытие на модуле с следующим → уведомления нет (кнопка 7a
 *      рендерится HubStory — покрыто юнит-тестами хаба).
 *
 * Доставку делают Def-подписки stories (`WishInviteStory`, `HubStory`):
 * приглашение — кнопочный проактив канала invite. Стенд: TestApp +
 * TestBotTransport.
 */

const COURSE_ID = 'fafafafa-baba-4aba-8aba-babababababa'; // Основы программирования (2 фазы)
const FIRST_MODULE = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0'; // JavaScript Основы
const LAST_MODULE = 'a1a1a1a1-b1b1-4b1b-8b1b-b1b1b1b1b1b1'; // Алгоритмика (последняя фаза)

const MENTOR_TG = 1004;
const WISHER_TG = 1002; // «Кандидат» (SUBSCRIBER)
const STUDENT_ADV_TG = 1007; // «Марина» (прошла a0a0a0a0)
const STUDENT_ACTIVE_TG = 1003; // «Студент» (active на e1e1e1e1, a0a0a0a0)

describe('E2E: адресные уведомления stories (приглашение желающих, «Курс завершён»)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let mentor: U7BotActor;
  let wisher: U7BotActor;
  let studentAdvanced: U7BotActor;
  let studentActive: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('user-notify-e2e');
    transport = createTestBotTransport(app, [
      new AppController('https://t.me/u7_school_group'),
      new StreamsController(),
      new LearningController(),
      new MentorController(),
      new CoursesController(),
    ]);
    mentor = await app.userByTelegramId(MENTOR_TG);
    wisher = await app.userByTelegramId(WISHER_TG);
    studentAdvanced = await app.userByTelegramId(STUDENT_ADV_TG);
    studentActive = await app.userByTelegramId(STUDENT_ACTIVE_TG);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('открытие набора → желающий получает одно уведомление (FR-6 #8)', async () => {
    transport.reset();

    // 1. Желающий выражает желание пройти курс
    expectOk(
      await app.apiApp.dispatch(
        WishModuleDef,
        CreateCourseWishUcDef.command({ courseId: COURSE_ID }),
        wisher,
        testTrace(),
      ),
    );

    // 2. Ментор открывает набор на первый модуль курса
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CreateStreamUcDef.command({
          title: 'Основы JS — Поток осени',
          description: 'Набор на первый модуль',
          moduleId: FIRST_MODULE,
          startDate: Date.UTC(2026, 9, 1),
        }),
        mentor,
        testTrace(),
      ),
    );

    // 3. Желающему доставлено ровно одно кнопочное приглашение (канал
    //    invite): курс, поток, дата, ментор, кнопка отмены (MarkdownV2)
    const text = await transport.waitForMessage(WISHER_TG);
    expect(text).toBeDefined();
    expect(text).toContain('📣 *Открылся набор\\!*');
    expect(text).toContain('У тебя было желание пройти курс');
    expect(text).toContain('Поток: «Основы JS — Поток осени»');
    expect(text).toContain('Старт: 01\\.10\\.2026, 05:00 \\(UTC\\+5\\)');
    expect(text).toContain('Ментор');
    // Поток создан без enrollmentKey → запись свободная
    expect(text).toContain('Запись свободная');
    expect(text).toContain('📝 Записаться');

    // Кнопка отмены ведёт в W05 (подтверждение отмены course-желания)
    const wisherMessage = transport.api.sentMessages.find(
      (m) => m.telegramId === WISHER_TG,
    );
    const cancelButton = wisherMessage?.keyboard?.rows
      .flat()
      .find((b) => b.text.includes('Отменить желание'));
    expect(cancelButton).toBeDefined();
    expect(cancelButton!.code).toContain('course-catalog:cancel:');

    // Нажатие кнопки из приглашения → W05 (подтверждение) → отмена
    const w05 = await transport.handleCallback(
      transport.makeBotContext(WISHER_TG, { callbackData: cancelButton!.code }),
    );
    expect(String(w05.screen?.text)).toContain('Отменить желание пройти курс?');
    // Код «✅ Да» берём из доставленного экрана (штамп seq)
    const yesCode = pressedCode(transport, WISHER_TG, '✅ Да');
    const done = await transport.handleCallback(
      transport.makeBotContext(WISHER_TG, { callbackData: yesCode }),
    );
    expect(String(done.screen?.text)).toContain('отменено');

    // Желание в репозитории отменено
    const wishes = await app.wishRepo.findAllByKind('course');
    expect(
      wishes.some((ar) => {
        const w = ar.snapshot();
        return w.userId === wisher.user.uuid && w.status === 'cancelled';
      }),
    ).toBe(true);

    // Ровно одно проактивное приглашение (дальнейшие экраны —
    // уже сценарий отмены, инициированный пользователем)
    const invitesToWisher = transport.api.sentMessages.filter(
      (m) => m.telegramId === WISHER_TG && m.text.includes('Открылся набор'),
    );
    expect(invitesToWisher).toHaveLength(1);
  });

  test('закрытие потока на последнем модуле → «🎉 Курс завершён!» (FR-6 #7c)', async () => {
    transport.reset();

    // 1. Ментор открывает поток на последнем модуле программы
    const stream = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CreateStreamUcDef.command({
          title: 'Алгоритмика — Финальный поток',
          description: 'Последний модуль программы',
          moduleId: LAST_MODULE,
          startDate: Date.UTC(2026, 10, 1),
        }),
        mentor,
        testTrace(),
      ),
    );

    // 2. Студент, прошедший первый модуль, записывается (gate пройден)
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        EnrollStudentUcDef.command({ streamId: stream.streamId }),
        studentAdvanced,
        testTrace(),
      ),
    );
    const record = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentByUserUcDef.command({ userId: studentAdvanced.user.uuid }),
        mentor,
        testTrace(),
      ),
    );
    expect(record.streamId).toBe(stream.streamId);

    // 3. Ментор активирует поток — студент станет active с выданным шагом
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        ActivateStreamUcDef.command({ streamId: stream.streamId }),
        mentor,
        testTrace(),
      ),
    );

    // 4. Ментор завершает студента с исходом «прошёл»
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CompleteStudentUcDef.command({
          streamId: stream.streamId,
          studentId: record.uuid,
          outcome: 'advanced',
        }),
        mentor,
        testTrace(),
      ),
    );

    // 5. Студенту доставлено поздравление с завершением курса
    const text = await transport.waitForMessage(STUDENT_ADV_TG);
    expect(text).toBeDefined();
    expect(text).toContain('Курс завершён');
    expect(text).toContain('Поздравляем');
  });

  test('закрытие на модуле с следующим → уведомления студенту нет (кнопка 7a)', async () => {
    transport.reset();

    // Студент f0f0f0f0 (e1e1e1e1, модуль a0a0a0a0) — есть следующий модуль
    const record = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentByUserUcDef.command({ userId: studentActive.user.uuid }),
        mentor,
        testTrace(),
      ),
    );

    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CompleteStudentUcDef.command({
          streamId: record.streamId,
          studentId: record.uuid,
          outcome: 'advanced',
        }),
        mentor,
        testTrace(),
      ),
    );

    // Небольшая пауза: подписки шины синхронные, но доставка асинхронна
    await new Promise((r) => setTimeout(r, 200));

    // Текстового уведомления нет — оно приходит только при 7c/7d; HubStory
    // (стенд с LearningController) шлёт кнопочное приглашение 7a
    const toStudent = transport.api.sentMessages.filter(
      (m) => m.telegramId === STUDENT_ACTIVE_TG,
    );
    expect(toStudent.map((m) => m.text).join('\n')).toContain(
      'записаться на следующий',
    );
    expect(toStudent.some((m) => m.text.includes('Курс завершён'))).toBe(false);
  });

  // ── Прямые уведомления вместо `user.notified` ──

  test('P1-50: уведомление уходит через `proactiveSender.notify` — заголовок вида и без кнопок', async () => {
    const tgId = STUDENT_ACTIVE_TG;
    const expected: Array<['notify' | 'info' | 'warn', string]> = [
      ['notify', '🔔 *Уведомление:*'],
      ['info', 'ℹ️ *Информация:*'],
      ['warn', '⚠️ *Внимание:*'],
    ];

    for (const [kind, header] of expected) {
      transport.reset();
      await transport.transport.notify(tgId, {
        text: md`Текст вида ${kind}`,
        kind,
      });

      const sent = transport.api.sentMessages.at(-1);
      expect(sent?.telegramId).toBe(tgId);
      expect(sent?.text).toStartWith(header);
      expect(sent?.text).toContain(`Текст вида ${kind}`);
      // Ранее кнопки ставил NotifyStory — теперь их нет
      expect(sent?.keyboard).toBeUndefined();
    }
  });

  test('P1-51: событие на несуществующего адресата — тишина без исключения', async () => {
    transport.reset();

    publish(StudentEvents.completed, {
      studentId: 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0',
      userId: crypto.randomUUID(),
      streamId: 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
      moduleId: FIRST_MODULE,
      outcome: 'advanced',
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(transport.api.sentMessages).toEqual([]);
  });

  test('P3-35: хаб подписан на student.completed — событие доходит до стори', async () => {
    transport.reset();

    publish(StudentEvents.completed, {
      studentId: 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0',
      userId: studentActive.user.uuid,
      streamId: 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
      moduleId: FIRST_MODULE,
      outcome: 'advanced',
    });

    const text = await transport.waitForMessage(STUDENT_ACTIVE_TG, {
      contains: 'Модуль завершён',
    });
    expect(text).toBeDefined();
    expect(text).toContain('Хочешь записаться на следующий');
  });

  test('P3-36: outcome=not_advanced — приглашение повторить тот же модуль', async () => {
    transport.reset();

    publish(StudentEvents.completed, {
      studentId: 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0',
      userId: studentActive.user.uuid,
      streamId: 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
      moduleId: FIRST_MODULE,
      outcome: 'not_advanced',
    });

    const text = await transport.waitForMessage(STUDENT_ACTIVE_TG, {
      contains: 'Модуль не пройден до конца',
    });
    expect(text).toBeDefined();

    // Кнопка ведёт в тот же модуль (wish → create-module-wish)
    const sent = transport.api.sentMessages.find(
      (m) => m.telegramId === STUDENT_ACTIVE_TG,
    );
    const retry = sent?.keyboard?.rows
      .flat()
      .find((b) => b.text.includes('Пройти модуль снова'));
    expect(retry).toBeDefined();
    expect(retry!.code).toStartWith('course:course-catalog:wish:');
    expect(retry!.code).toContain(FIRST_MODULE.slice(0, 8));
  });

  test('P3-37: advanced со следующим модулем → «🏁 Модуль завершён!» и кнопка на следующий', async () => {
    transport.reset();

    // Поток на первом модуле программы кидает событие completed(advanced) из UC
    const stream = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CreateStreamUcDef.command({
          title: 'Основы JS — повторный запуск',
          description: 'Проверка ветки 7a',
          moduleId: FIRST_MODULE,
          startDate: Date.UTC(2026, 11, 1),
        }),
        mentor,
        testTrace(),
      ),
    );
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        EnrollStudentUcDef.command({ streamId: stream.streamId }),
        studentAdvanced,
        testTrace(),
      ),
    );
    const record = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentByUserUcDef.command({ userId: studentAdvanced.user.uuid }),
        mentor,
        testTrace(),
      ),
    );
    expect(record.streamId).toBe(stream.streamId);
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        ActivateStreamUcDef.command({ streamId: stream.streamId }),
        mentor,
        testTrace(),
      ),
    );
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CompleteStudentUcDef.command({
          streamId: stream.streamId,
          studentId: record.uuid,
          outcome: 'advanced',
        }),
        mentor,
        testTrace(),
      ),
    );

    const text = await transport.waitForMessage(STUDENT_ADV_TG, {
      contains: 'Модуль завершён',
    });
    expect(text).toBeDefined();
    expect(text).toContain('Хочешь записаться на следующий');

    // Кнопка ведёт на следующий модуль программы (a1a1…)
    const sent = transport.api.sentMessages.find(
      (m) => m.telegramId === STUDENT_ADV_TG,
    );
    const next = sent?.keyboard?.rows.flat()[0];
    expect(next?.text).toBe('➡️ Следующий модуль');
    expect(next?.code).toStartWith('course:course-catalog:wish:');
    expect(next?.code).toContain(LAST_MODULE.slice(0, 8));
  });

  /** Публикует Def-событие под FQN (payload валидируется схемой Def). */
  function publish<E extends AnyEventDef>(
    event: E,
    payload: v.InferInput<E['payload']>,
  ): void {
    app.eventBus.publish(
      envelopeOf(event, v.parse(event.payload, payload) as never, {
        occurredAt: Date.now(),
        aggregateId: crypto.randomUUID(),
      }),
    );
  }
});
