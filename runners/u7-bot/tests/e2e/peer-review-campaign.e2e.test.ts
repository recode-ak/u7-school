import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import {
  GetMyReviewUcDef,
  PeerReviewModuleDef,
  ReviewCampaignEvents,
} from '@u7-scl/domain/peer-review/contract';
import { StudentEvents } from '@u7-scl/domain/stream/contract';
import { Role } from '@u7-scl/domain/user/testing';
import { envelopeOf } from '@u7-scl/test-helpers/envelope-of';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { waitUntil } from '@u7-scl/test-helpers/wait-until';
import type { AnyEventDef } from 'dmg-core';
import type { EventBus } from 'dmg-core/app';
import { testTrace } from 'dmg-core/testing';
import * as v from 'valibot';
import { PeerReviewController } from '../../src/controllers/peer-review/controller';
import {
  completeStudent,
  dropStudent,
  makeStudentActive,
} from '../helpers/student-fate';
import { CORE_EDUCATION_WORLD, type WorldDefinition } from '../worlds';

/**
 * E2E «Судьба субъекта — написание» (Фаза 6, задача 2): сквозной путь
 * субъекта от события судьбы до перезаписи отзыва.
 *
 *   student.completed → кампания (адресация v4) → два приглашения
 *   (субъекту и ментору, тексты по subjectOutcome) → клик субъекту →
 *   S03 (шапка, дни, ✅ нет) → короткий текст — переспрос → корректный
 *   ввод → S06 (✅ появился) → перезапись S04 (текст заменён).
 *
 * Один сквозной тест: сценарий stateful по природе (каждый шаг жмёт
 * кнопку предыдущего экрана — как реальный клиент).
 */

const STREAM_ID = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'; // «JS Core — Поток 2»
const STREAM_TITLE = 'JS Core — Поток 2';
const SUBJECT_TG = 1007; // «Марина» — субъект новой кампании
const SUBJECT_USER_ID = '77777777-7777-4777-8777-777777777777';
const MENTOR_TG = 1004; // «Ментор» — ментор потока и адресат
const MENTOR_USER_ID = '44444444-4444-4444-4444-444444444444';
// «Олег» — соученик субъекта; тест 3: субъект «забросил»
// (у Андрея 333 уже есть фикстурная кампания c1a11111 — идемпотентность ER)
const DROPPED_TG = 1008;
const DROPPED_STUDENT_ID = 'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2';
const DROPPED_USER_ID = '88888888-8888-4888-8888-888888888888';

const GOOD_TEXT = 'Ментор спокойно разбирал мои ошибки и не давал застрять.';
const GOOD_TEXT_2 = 'Вторая правка: ментор был внимателен к деталям.';

describe('E2E peer-review: судьба субъекта — написание', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-campaign');
    transport = createTestBotTransport(app, [new PeerReviewController()]);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('событие судьбы → приглашения → S03 → ввод → S06 → перезапись S04', async () => {
    // ── 1. Событие судьбы: завершил и прошел ──
    await completeStudent(app, {
      callerTelegramId: MENTOR_TG,
      streamId: STREAM_ID,
      studentId: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      outcome: 'advanced',
    });

    // ── 2. Два приглашения: субъекту (по исходу) и ментору (с именем) ──
    await waitUntil(
      () =>
        transport.api.sentMessages.some((m) => m.telegramId === SUBJECT_TG) &&
        transport.api.sentMessages.some((m) => m.telegramId === MENTOR_TG),
    );

    const subjectInvite = transport.api.sentMessages.find(
      (m) => m.telegramId === SUBJECT_TG,
    );
    expect(subjectInvite?.text).toContain(STREAM_TITLE);
    // Судьба проговаривается мягко, текст — про одногруппников и ментора
    expect(subjectInvite?.text).toContain('Ты завершил обучение');
    expect(subjectInvite?.text).toContain('об одногруппниках и менторе');

    const mentorInvite = transport.api.sentMessages.find(
      (m) => m.telegramId === MENTOR_TG,
    );
    expect(mentorInvite?.text).toContain(
      'Твой подопечный Марина завершил обучение — выдай ему отзыв',
    );

    // Полный код кнопки в обоих приглашениях
    const subjectBtn = subjectInvite?.keyboard?.rows.flat()[0];
    expect(subjectBtn?.text).toBe('💬 Отзывы');
    expect(subjectBtn?.code).toStartWith('peer-review:campaign:list:');
    expect(
      mentorInvite?.keyboard?.rows
        .flat()[0]
        ?.code.startsWith('peer-review:campaign:list:'),
    ).toBe(true);

    // ── 3. Клик субъекту из приглашения → S03 ──
    const s03 = await transport.handleCallback(
      transport.makeBotContext(SUBJECT_TG, { callbackData: subjectBtn!.code }),
    );
    expect(String(s03.screen?.text)).toContain(STREAM_TITLE);
    expect(String(s03.screen?.text)).toContain('О ком расскажешь?');
    expect(String(s03.screen?.text)).toContain(
      'Ты завершил обучение в этом потоке',
    );
    // Развёрнутые метрики: окно свежесозданной кампании — 7 дней
    expect(String(s03.screen?.text)).toContain('Написано отзывов: 0 из 3');
    expect(String(s03.screen?.text)).toContain('Осталось времени: 7 дн');
    const s03buttons = s03.screen?.keyboard?.rows.flat() ?? [];
    // Адресация v4: соученики (333, 888) + ментор, ✅ ещё нет
    expect(s03buttons.map((b) => b.text)).toEqual([
      'Одногруппник — Андрей',
      'Одногруппник — Олег',
      'Ментор — Алексей',
      '↩️ Мои отзывы',
    ]);

    // ── 4. Выбор ментора → S05 (подсказка по исходу автора) ──
    // Код кнопки — отштампованный транспорт-рендер последнего экрана
    const mentorBtnCode = pressedCode(
      transport,
      SUBJECT_TG,
      'Ментор — Алексей',
    );
    const s05 = await transport.handleCallback(
      transport.makeBotContext(SUBJECT_TG, { callbackData: mentorBtnCode }),
    );
    // шапка-ориентир: о каком потоке отзыв
    expect(String(s05.screen?.text)).toContain('✍️ *Отзыв — поток «');
    expect(String(s05.screen?.text)).toContain(
      'Предлагаем разделить отзыв на две части',
    );
    expect(String(s05.screen?.text)).toContain('что помогало учиться');
    expect(String(s05.screen?.text)).toContain('Моя рекомендация студентам:');
    // Принципы — общий блок экранов ввода + кнопки справки
    expect(String(s05.screen?.text)).toContain('Характеризуй навыки');
    // код кнопок — из отштампованного транспорт-рендера (pressedCode)
    expect(pressedCode(transport, SUBJECT_TG, 'Как писать отзыв')).toStartWith(
      'peer-review:campaign:how:',
    );
    // «Назад» при нескольких адресатах — в список кампании
    expect(pressedCode(transport, SUBJECT_TG, '↩️ Назад')).toStartWith(
      'peer-review:campaign:list:',
    );

    // справка — инфо-сообщение, экран и ввод не трогаются
    const how = await transport.press(SUBJECT_TG, 'Как писать отзыв');
    expect(String(how.notify?.text ?? '')).toContain('Как писать отзыв');
    expect(String(how.notify?.text ?? '')).toContain(
      'Экран ввода остаётся активным',
    );
    expect(how.screen).toBeUndefined();

    expect(s05.awaitInput).toBeDefined();

    // ── 5. Короткий текст — переспрос, контекст не теряется ──
    const warn = await transport.handleMessage(
      transport.makeBotContext(SUBJECT_TG, { text: 'коротко' }),
    );
    expect(String(warn.notify?.text ?? warn.screen?.text)).toContain(
      'Отзыв — от 10 символов',
    );
    expect(transport.dialogOf(SUBJECT_TG)?.input?.context).toEqual({
      campaignId: expect.any(String),
      recipientId: MENTOR_USER_ID,
    });

    // ── 6. Корректный ввод → S06: ✅ появился у ментора ──
    const s06 = await transport.handleMessage(
      transport.makeBotContext(SUBJECT_TG, { text: GOOD_TEXT }),
    );
    // инфо-сообщение о результате — поверх нового экрана-родителя
    expect(String(s06.notify?.text ?? '')).toContain(
      '✅ Отзыв о Алексей сохранён',
    );
    // экран-родитель: список кампании (несколько адресатов)
    expect(String(s06.screen?.text)).toContain('О ком расскажешь?');
    // Финализация: старый экран ввода закрыт edit'ом (без клавиатуры),
    // новый экран и инфо — отдельными сообщениями внизу чата:
    // после текста пользователя всё актуальное видно без прокрутки
    const lastEdit = transport.api.editedMessages.at(-1);
    expect(lastEdit?.text).toContain('отзыв о Алексей отправлен');
    expect(lastEdit?.keyboard).toBeUndefined();
    const lastSent = transport.api.sentMessages.at(-1);
    expect(lastSent?.text).toContain('О ком расскажешь?');
    expect(String(s06.screen?.text)).not.toContain('сохранён');
    const s06buttons = s06.screen?.keyboard?.rows.flat() ?? [];
    expect(s06buttons.map((b) => b.text)).toEqual([
      'Одногруппник — Андрей',
      'Одногруппник — Олег',
      '✅Ментор — Алексей',
      '↩️ Мои отзывы',
    ]);

    // ── 7. Перезапись: клик ✅ ментора → S04 с текущим текстом ──
    const rewriteBtnCode = pressedCode(
      transport,
      SUBJECT_TG,
      '✅Ментор — Алексей',
    );
    const s04 = await transport.handleCallback(
      transport.makeBotContext(SUBJECT_TG, {
        callbackData: rewriteBtnCode,
      }),
    );
    expect(String(s04.screen?.text)).toContain('Ты уже писал');
    expect(String(s04.screen?.text)).toContain('о Алексей');
    expect(String(s04.screen?.text)).toContain(
      '«Ментор спокойно разбирал мои ошибки и не давал застрять',
    );
    expect(String(s04.screen?.text)).toContain('он заменит текущий');
    expect(s04.screen?.keyboard?.rows.flat()[0]?.text).toBe('↩️ Назад');

    // ── 8. Новый текст заменяет старый ──
    const s06b = await transport.handleMessage(
      transport.makeBotContext(SUBJECT_TG, { text: GOOD_TEXT_2 }),
    );
    expect(String(s06b.notify?.text ?? '')).toContain(
      '✏️ Отзыв о Алексей обновлён',
    );
    expect(String(s06b.screen?.text)).toContain('О ком расскажешь?');

    const subject = await app.userByTelegramId(SUBJECT_TG);
    const campaign = await app.reviewCampaignRepo.findBySubject(
      STREAM_ID,
      SUBJECT_USER_ID,
    );
    const res = await app.apiApp.dispatch(
      PeerReviewModuleDef,
      GetMyReviewUcDef.command({
        campaignId: campaign!.uuid,
        recipientId: MENTOR_USER_ID,
      }),
      subject,
      testTrace(),
    );
    if (!res.ok) throw new Error(res.error.code);
    expect(res.value.found).toBe(true);
    expect(res.value.text).toBe(GOOD_TEXT_2);
  });

  // Продолжение кампании из предыдущего теста (stateful-сценарий):
  // отзыв ментору уже сохранён — 1/3, ✅ у ментора.
  test('несколько адресатов: одногруппник — выбор из списка, метрики 1/3 → 2/3', async () => {
    // ── Хаб: карточка кампании с прогрессом 1/3 ──
    const hub = await transport.press(SUBJECT_TG, '↩️ Мои отзывы');
    expect(String(hub.screen?.text)).toContain('💬 *Мои отзывы*');
    expect(String(hub.screen?.text)).toContain('Метрики: 1/3');
    expect(String(hub.screen?.text)).toContain('Ты завершил обучение');

    // ── Карточка кампании → S03: ✅ у ментора, одногруппники без ✅ ──
    const s03 = await transport.press(SUBJECT_TG, 'Поток «');
    expect(String(s03.screen?.text)).toContain('Написано отзывов: 1 из 3');
    expect(s03.screen?.keyboard?.rows.flat().map((b) => b.text)).toEqual([
      'Одногруппник — Андрей',
      'Одногруппник — Олег',
      '✅Ментор — Алексей',
      '↩️ Мои отзывы',
    ]);

    // ── Одногруппник → S05: подсказка с именем адресата ──
    const s05 = await transport.press(SUBJECT_TG, 'Андрей');
    const s05Text = String(s05.screen?.text);
    expect(s05Text).toContain('`Отзыв для {Имя}:`');
    expect(s05Text).toContain('расскажи, как Андрей');
    expect(s05Text).toContain('`Как с ним работать:`');
    expect(s05.awaitInput).toBeDefined();

    // ── Ввод → инфо + S03: 2/3, ✅ у Андрея и у ментора ──
    const s06 = await transport.handleMessage(
      transport.makeBotContext(SUBJECT_TG, {
        text: 'Андрей задавал точные вопросы на созвонах и помогал команде не буксовать.',
      }),
    );
    expect(String(s06.notify?.text ?? '')).toContain(
      '✅ Отзыв о Андрей сохранён',
    );
    expect(String(s06.screen?.text)).toContain('Написано отзывов: 2 из 3');
    expect(s06.screen?.keyboard?.rows.flat().map((b) => b.text)).toEqual([
      '✅Одногруппник — Андрей',
      'Одногруппник — Олег',
      '✅Ментор — Алексей',
      '↩️ Мои отзывы',
    ]);
  });

  // Живое окно «забросил»: адресат только ментор — автопровал
  // в экран ввода, минуя список (правило «выбор без выбора»).
  test('dropped: автопровал единственного адресата → ввод → сохранение → хаб', async () => {
    // ── 1. Судьба: Андрей забросил учёбу (UC drop-student от студента) ──
    await makeStudentActive(app, DROPPED_STUDENT_ID);
    await dropStudent(app, {
      studentTelegramId: DROPPED_TG,
      streamId: STREAM_ID,
      studentId: DROPPED_STUDENT_ID,
    });

    // ── 2. Приглашение с мягким текстом судьбы ──
    await waitUntil(() =>
      transport.api.sentMessages.some(
        (m) => m.telegramId === DROPPED_TG && m.text.includes('покинул'),
      ),
    );
    const invite = transport.api.sentMessages.find(
      (m) => m.telegramId === DROPPED_TG && m.text.includes('покинул'),
    )!;
    expect(invite.text).toContain('Ты покинул обучение');
    expect(invite.text).toContain('поделись впечатлениями о менторе');

    // ── 3. Клик приглашения → сразу S05 (список не показывается) ──
    const btn = invite.keyboard?.rows.flat()[0]!;
    const s05 = await transport.handleCallback(
      transport.makeBotContext(DROPPED_TG, { callbackData: btn.code }),
    );
    const s05Text = String(s05.screen?.text);
    expect(s05Text).toContain('✍️ *Отзыв — поток «');
    // Подсказка пары «забросил → о менторе»
    expect(s05Text).toContain('`Отзыв для ментора:`');
    expect(s05Text).toContain('почему забросил');
    expect(s05Text).toContain('`Следует ожидать от курса:`');
    expect(s05.awaitInput).toBeDefined();
    // «Назад» при единственном адресате — в хаб
    expect(s05.screen?.keyboard?.rows.flat()[0]?.text).toBe('↩️ Мои отзывы');

    // ── 4. Ввод → инфо + возврат в хаб (родитель единственного адресата) ──
    const done = await transport.handleMessage(
      transport.makeBotContext(DROPPED_TG, {
        text: 'Ментор быстро отвечал на вопросы, но мне не хватило времени на учёбу.',
      }),
    );
    expect(String(done.notify?.text ?? '')).toContain(
      '✅ Отзыв о Алексей сохранён',
    );
    const hubText = String(done.screen?.text);
    expect(hubText).toContain('💬 *Мои отзывы*');
    expect(hubText).toContain('Ты покинул обучение');
    expect(hubText).toContain('Метрики: 1/1');
  });
});

// ═══ Судьба и приглашения: исход, идемпотентность, молчаливые пропуски ═══

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const ANDREY_TG = 1003;
const ANDREY_USER_ID = '33333333-3333-3333-3333-333333333333';
const LIVE_CAMPAIGN_ID = 'c1a11111-1111-4111-8111-111111111111';
const CANDIDATE_USER_ID = '22222222-2222-2222-2222-222222222222';
/** Скоуп/профиль, которых нет в мире: состав потока и адресат недоступны. */
const LOST_STREAM_ID = 'dead0001-0000-4000-8000-000000000001';
const LOST_USER_ID = 'dead0002-0000-4000-8000-000000000002';
// «Новичок»: зачислен в поток 2 и не завершил ни одного шага → «не начал»
const NEVER_STARTED_TG = 1012;
const NEVER_STARTED_PERSON_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NEVER_STARTED_STUDENT_ID = 'f9f9f9f9-f9f9-49f9-89f9-f9f9f9f9f9f9';

/** Мир `core-education` плюс студент, который так и не начал обучение. */
const NEVER_STARTED_WORLD: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'core-education-never-started',
  description: 'Мир с зачисленным студентом без единого шага',
  persons: [
    ...(CORE_EDUCATION_WORLD.persons ?? []),
    {
      key: 'newbie',
      uuid: NEVER_STARTED_PERSON_ID,
      name: 'Новичок',
      telegramId: NEVER_STARTED_TG,
      roles: [Role.GUEST],
      registeredAt: 'T-5d',
    },
  ],
  students: [
    ...(CORE_EDUCATION_WORLD.students ?? []),
    {
      key: 'student-newbie-s2',
      uuid: NEVER_STARTED_STUDENT_ID,
      personKey: 'newbie',
      streamKey: 'stream-2-active',
      enrolledAt: 'T-5d',
      status: 'enrolled',
      steps: [],
    },
  ],
};

/** Публикует Def-событие на общей шине (payload валидируется схемой Def). */
function publish<E extends AnyEventDef>(
  bus: EventBus,
  event: E,
  payload: v.InferInput<E['payload']>,
): void {
  bus.publish(
    envelopeOf(event, v.parse(event.payload, payload) as never, {
      eventId: crypto.randomUUID(),
    }),
  );
}

/** Записи хранилища кампаний стенда (проверка «кампания не создана/одна»). */
async function storedCampaigns(
  app: TestApp,
): Promise<Array<{ uuid: string; scopeId: string; subjectId: string }>> {
  return JSON.parse(
    await Bun.file(app.fixtures.peerReview.campaigns).text(),
  ) as Array<{ uuid: string; scopeId: string; subjectId: string }>;
}

describe('E2E peer-review: событие судьбы — исход и приглашения', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-campaign-events');
    transport = createTestBotTransport(app, [new PeerReviewController()]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  const sentTo = (tgId: number) =>
    transport.api.sentMessages.filter((m) => m.telegramId === tgId);

  test('P6-04: повтор события судьбы — кампания не дублируется, приглашения не повторяются', async () => {
    const fate = {
      studentId: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      userId: SUBJECT_USER_ID,
      streamId: STREAM_ID,
      who: 'self' as const,
      cause: 'voluntary' as const,
    };
    publish(app.eventBus, StudentEvents.abandoned, fate);
    await waitUntil(
      () => sentTo(SUBJECT_TG).length > 0 && sentTo(MENTOR_TG).length > 0,
    );

    // Тот же субъект ушёл повторно (дубль доставки/повтор судьбы)
    publish(app.eventBus, StudentEvents.abandoned, fate);
    await new Promise((r) => setTimeout(r, 200));

    expect(sentTo(SUBJECT_TG)).toHaveLength(1);
    expect(sentTo(MENTOR_TG)).toHaveLength(1);
    const pair = (await storedCampaigns(app)).filter(
      (c) => c.scopeId === STREAM_ID && c.subjectId === SUBJECT_USER_ID,
    );
    expect(pair).toHaveLength(1);
  });

  test('P6-05: состав потока недоступен — кампания не создана, приглашений нет', async () => {
    publish(app.eventBus, StudentEvents.abandoned, {
      studentId: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      userId: SUBJECT_USER_ID,
      streamId: LOST_STREAM_ID,
      who: 'self',
      cause: 'voluntary',
    });
    await new Promise((r) => setTimeout(r, 250));

    // Ни исключения, ни приглашений: ER предупредил в лог и вышел
    expect(transport.api.sentMessages).toEqual([]);
    const pair = (await storedCampaigns(app)).filter(
      (c) => c.scopeId === LOST_STREAM_ID,
    );
    expect(pair).toHaveLength(0);
  });

  test('P6-10/P6-11: профиль субъекта не найден — его приглашение пропущено, ментору — «студент»', async () => {
    publish(app.eventBus, ReviewCampaignEvents.created, {
      campaignId: crypto.randomUUID(),
      context: 'stream_fate',
      scopeId: STREAM_ID,
      subjectId: LOST_USER_ID,
      mentorId: MENTOR_USER_ID,
      subjectOutcome: 'dropped',
    });
    await waitUntil(() => sentTo(MENTOR_TG).length > 0);
    await new Promise((r) => setTimeout(r, 150));

    // Субъекту доставлять некуда — приглашения нет, второго не отменяет
    expect(sentTo(SUBJECT_TG)).toHaveLength(0);
    expect(sentTo(MENTOR_TG)).toHaveLength(1);
    // Имя не найдено — приглашение ментору с подстановкой «студент»
    expect(String(sentTo(MENTOR_TG)[0]?.text)).toContain(
      'Твой подопечный студент покинул обучение',
    );
    expect(String(sentTo(MENTOR_TG)[0]?.text)).toContain(
      'поделись наблюдениями',
    );
  });

  test('P6-12: потока нет — оба приглашения молча не отправлены', async () => {
    publish(app.eventBus, ReviewCampaignEvents.created, {
      campaignId: crypto.randomUUID(),
      context: 'stream_fate',
      scopeId: LOST_STREAM_ID,
      subjectId: SUBJECT_USER_ID,
      mentorId: MENTOR_USER_ID,
      subjectOutcome: 'completed_passed',
    });
    await new Promise((r) => setTimeout(r, 250));

    expect(transport.api.sentMessages).toEqual([]);
  });
});

describe('E2E peer-review: событие «не начал» — приглашения по судьбе', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-campaign-never-started', NEVER_STARTED_WORLD);
    transport = createTestBotTransport(app, [new PeerReviewController()]);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P6-08/P6-10: исход never_started — тексты приглашений субъекту и ментору', async () => {
    await dropStudent(app, {
      studentTelegramId: NEVER_STARTED_TG,
      streamId: STREAM_ID,
      studentId: NEVER_STARTED_STUDENT_ID,
    });

    await waitUntil(
      () =>
        transport.api.sentMessages.some(
          (m) => m.telegramId === NEVER_STARTED_TG,
        ) && transport.api.sentMessages.some((m) => m.telegramId === MENTOR_TG),
    );

    const subjectInvite = transport.api.sentMessages.find(
      (m) => m.telegramId === NEVER_STARTED_TG,
    );
    expect(String(subjectInvite?.text)).toContain(
      'Ты записался, но так и не начал обучение',
    );
    expect(String(subjectInvite?.text)).toContain('расскажи, что остановило');

    const mentorInvite = transport.api.sentMessages.find(
      (m) => m.telegramId === MENTOR_TG,
    );
    expect(String(mentorInvite?.text)).toContain(
      'Твой подопечный Новичок покинул обучение',
    );
    expect(String(mentorInvite?.text)).toContain('поделись наблюдениями');
  });
});

// ═══ Кампания: ошибочные пути экранов (фикстурная кампания «Андрея») ═══

describe('E2E peer-review: ошибочные пути кампании', () => {
  let app: TestApp;
  let clock: NonNullable<TestApp['clock']>;
  let transport: TestBotTransport;

  beforeAll(async () => {
    // Часы на якорь мира: фикстурная кампания c1a11111 жива (окно T+5d)
    app = await createTestApp('pr-campaign-errors', undefined, { clock: {} });
    if (!app.clock) throw new Error('ожидались управляемые часы');
    clock = app.clock;
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new PeerReviewController(),
    ]);
  });

  beforeEach(async () => {
    // Свежий /start: штамп кнопок текущего экрана — для крафтовых кодов
    transport.reset();
    await transport.handleStart(transport.makeBotContext(ANDREY_TG));
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P6-22: кампании нет в БД — «Кампания не найдена» и возврат в хаб', async () => {
    const response = await transport.pressRaw(
      ANDREY_TG,
      `peer-review:campaign:list:${crypto.randomUUID()}`,
    );
    expect(String(response.screen?.text)).toContain('Кампания не найдена');
    expect(response.screen?.keyboard?.rows.flat()[0]?.text).toBe(
      '↩️ Мои отзывы',
    );
  });

  test('P6-26: адресат вне списка кампании — «Адресат недоступен»', async () => {
    const response = await transport.pressRaw(
      ANDREY_TG,
      `peer-review:campaign:open:${LIVE_CAMPAIGN_ID}:${CANDIDATE_USER_ID}`,
    );
    expect(String(response.screen?.text)).toContain('Адресат недоступен');
    expect(response.screen?.keyboard?.rows.flat()[0]?.text).toBe(
      '↩️ Мои отзывы',
    );
  });

  test('P6-28: неизвестный campaign:* — «Неизвестная команда»', async () => {
    const response = await transport.pressRaw(
      ANDREY_TG,
      `peer-review:campaign:foo:${LIVE_CAMPAIGN_ID}`,
    );
    expect(String(response.screen?.text)).toContain('Неизвестная команда');
  });

  // P6-33 («текст на экране без контекста ввода») — ветка стори недостижима:
  // BotTransport перехватывает текст вне ввода подсказкой и не зовёт
  // handleMessage стори (P1-33 покрыт в transport.e2e.test.ts).

  test('P6-30: текст длиннее 3500 символов — предупреждение, ввод сохранён', async () => {
    await transport.pressRaw(
      ANDREY_TG,
      `peer-review:campaign:open:${LIVE_CAMPAIGN_ID}:${MENTOR_USER_ID}`,
    );
    const response = await transport.sendText(ANDREY_TG, 'а'.repeat(3501));
    expect(String(response.notify?.text ?? '')).toContain('3500 символов');
    expect(String(response.notify?.text ?? '')).toContain('сократи отзыв');
    // Контекст ввода не потерян — следующее сообщение снова попадёт в отзыв
    expect(transport.dialogOf(ANDREY_TG)?.input?.context).toEqual({
      campaignId: LIVE_CAMPAIGN_ID,
      recipientId: MENTOR_USER_ID,
    });
  });

  test('P6-35: кампания исчезла, пока писали — короткая реплика домена', async () => {
    const campaignsPath = app.fixtures.peerReview.campaigns;
    const original = await Bun.file(campaignsPath).text();
    await transport.pressRaw(
      ANDREY_TG,
      `peer-review:campaign:open:${LIVE_CAMPAIGN_ID}:${MENTOR_USER_ID}`,
    );
    try {
      // Гонка: кампанию удалили между экраном ввода и отправкой текста
      const rows = (JSON.parse(original) as Array<{ uuid: string }>).filter(
        (c) => c.uuid !== LIVE_CAMPAIGN_ID,
      );
      await Bun.write(campaignsPath, JSON.stringify(rows, undefined, 2));

      const response = await transport.sendText(
        ANDREY_TG,
        'Ментор подробно разбирал мои решения и не давал буксовать.',
      );
      expect(String(response.notify?.text ?? '')).toContain(
        'Кампания отзывов не найдена',
      );
      expect(response.screen).toBeUndefined();
    } finally {
      await Bun.write(campaignsPath, original);
    }
  });

  test('P6-34: окно закрылось, пока писали — финализация и экран-заглушка', async () => {
    await transport.pressRaw(
      ANDREY_TG,
      `peer-review:campaign:open:${LIVE_CAMPAIGN_ID}:${MENTOR_USER_ID}`,
    );
    // Окно (7 сут.) истекло за время написания текста
    clock.advance(8 * 24 * 60 * 60 * 1000);

    const response = await transport.sendText(
      ANDREY_TG,
      'Ментор подробно разбирал мои решения и не давал буксовать.',
    );
    expect(String(response.finalize?.text ?? '')).toContain(
      'Окно закрылось — отзыв о Алексей не отправлен',
    );
    expect(String(response.screen?.text)).toContain(
      'Возможность написать отзыв уже закрыта',
    );
    expect(response.screen?.keyboard?.rows.flat()[0]?.text).toBe(
      '↩️ Мои отзывы',
    );
  });
});
