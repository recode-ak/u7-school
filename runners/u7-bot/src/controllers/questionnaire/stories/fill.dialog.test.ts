import { describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import {
  AbandonUcDef,
  QuestionnaireErrors,
  QuestionnaireEvents,
} from '@u7-scl/domain/questionnaire/contract';
import { FillStory } from './fill.story';
import {
  buttonsOf,
  dispatchedOf,
  initStory,
  RESPONDENT_ID,
  refuse,
  respondentProfile,
  startedEvent,
  subscriptionOf,
  useMockLogger,
  warnsOf,
} from './questionnaire-dmg.test-kit';

/**
 * Поведенческие тесты FillStory на контракте «Диалог и Экран»
 * (DialogResponse): finalize-паттерн («зафиксируй выбор → следующий
 * вопрос»), awaitInput/release, валидация ответов — errorNotify
 * (переспрос, ввод живёт).
 *
 * Контракт ввода: fill-диалог ставит awaitInput{context:{questionnaireId}}
 * при входе; последующие ответы НИЧЕГО не переустанавливают (input живёт),
 * пока не придёт release при завершении анкеты.
 */
//
// ══ Помощники ══

const actor = { uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' } as User;

const radioQuestion = {
  questionCode: 'qc1',
  type: 'choice' as const,
  multiple: false,
  question: 'Какой у тебя опыт?',
  answers: [
    { answer: 'Новичок', answerCode: 'novice' },
    { answer: 'Средний', answerCode: 'mid' },
  ],
};

const nextTextQuestion = {
  questionCode: 'qc2',
  type: 'text' as const,
  question: 'Расскажи о себе',
};

/** Сессия активного fill-диалога: ожидание ввода с анкетой q-1. */
function fillSession(): BotSession {
  return {
    dialog: {
      path: 'questionnaire/fill',
      seq: 4,
      input: { context: { questionnaireId: 'q-1' } },
    },
    screen: { messageId: 42, ownerSeq: 3, text: 'Вопрос' },
  };
}

/** Сессия чужого диалога (меню) — fill неактивна. */
function menuSession(): BotSession {
  return { dialog: { path: 'app/menu', seq: 2 } };
}

// ══ Finalize-паттерн ══

describe('FillStory — finalize-паттерн («зафиксируй выбор → следующий вопрос»)', () => {
  test('single answer: finalize с финальными маркерами \\(x\\)/\\( \\), screen — следующий вопрос, ввод живёт', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: nextTextQuestion,
          previousQuestion: radioQuestion,
          previousSelectedAnswers: ['novice'],
          questionIndex: 2,
          poolSize: 2,
        }),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:novice',
      actor,
      fillSession(),
    );

    // UC вызван с выбором варианта
    expect(dispatchedOf(dispatch)).toEqual([
      {
        uc: 'handleAction',
        input: { questionnaireId: 'q-1', type: 'callback', value: 'novice' },
      },
    ]);

    // Предыдущий вопрос зафиксирован: выбранный отмечен, прочие — нет
    expect(res.finalize).toBeDefined();
    expect(res.finalize?.text).toContain('\\(x\\)');
    expect(res.finalize?.text).toContain('\\( \\)');
    expect(res.finalize?.text).toContain('Какой у тебя опыт?');
    expect(() => assertMarkdownV2Safe(res.finalize!.text)).not.toThrow();

    // Новый вопрос на экране
    expect(String(res.screen?.text)).toContain('Расскажи о себе');

    // Ввод живёт: ни повторный awaitInput, ни release
    expect(res.awaitInput).toBeUndefined();
    expect(res.release).toBeUndefined();
  });

  test('multiple «Далее»: finalize с маркерами \\[x\\] экрана мультивыбора', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: nextTextQuestion,
          previousQuestion: {
            questionCode: 'qc1',
            type: 'choice' as const,
            multiple: true,
            question: 'Что интересно?',
            answers: [
              { answer: 'Фронтенд', answerCode: 'fe' },
              { answer: 'Бэкенд', answerCode: 'be' },
            ],
          },
          previousSelectedAnswers: ['fe', 'be'],
        }),
      },
    });

    const res = await story.handleCallback(
      'next:q-1:qc1',
      actor,
      fillSession(),
    );

    expect(res.finalize?.text).toContain('\\[x\\]');
    expect(res.finalize?.text).toContain('Что интересно?');
    expect(res.screen).toBeDefined();
  });

  test('текстовый ответ: finalize предыдущего вопроса + screen следующего', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: nextTextQuestion,
          previousQuestion: radioQuestion,
          previousSelectedAnswers: [],
        }),
      },
    });

    const res = await story.handleMessage(
      { type: 'message', text: '3 года фронтенда', telegramId: 1 },
      actor,
      fillSession(),
    );

    // UC вызван с type:'text' и значением из сообщения
    expect(dispatchedOf(dispatch)).toEqual([
      {
        uc: 'handleAction',
        input: {
          questionnaireId: 'q-1',
          type: 'text',
          value: '3 года фронтенда',
        },
      },
    ]);

    expect(res.finalize?.text).toContain('Какой у тебя опыт?');
    expect(String(res.screen?.text)).toContain('Расскажи о себе');
    expect(res.release).toBeUndefined();
  });

  test('completed: finalize + completionText + главное меню + release', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({
          type: 'completed',
          questionnaireId: 'q-1',
          previousQuestion: nextTextQuestion,
          previousSelectedAnswers: [],
          completionText: 'Спасибо! Анкета принята.',
        }),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:novice',
      actor,
      fillSession(),
    );

    expect(res.finalize?.text).toContain('Расскажи о себе');
    // Шапка по ui-spec S04 + completionText из пула
    expect(String(res.screen?.text)).toContain('Анкета завершена');
    expect(String(res.screen?.text)).toContain('Анкета принята');
    expect(res.release).toBe(true);
  });

  test('completed без предыдущего вопроса: только screen + release, без finalize', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({ type: 'completed', questionnaireId: 'q-1' }),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:novice',
      actor,
      fillSession(),
    );

    expect(res.finalize).toBeUndefined();
    expect(res.screen).toBeDefined();
    expect(res.release).toBe(true);
  });

  test('fallback completionText: «Спасибо! Твоя анкета принята.»', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({ type: 'completed', questionnaireId: 'q-1' }),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:novice',
      actor,
      fillSession(),
    );

    expect(String(res.screen?.text)).toContain('Твоя анкета принята');
  });

  test('wait_next (тоггл): только screen без finalize — edit-in-place, клавиатура жива', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({
          type: 'wait_next',
          questionnaireId: 'q-1',
          currentQuestion: {
            questionCode: 'qc1',
            type: 'choice' as const,
            multiple: true,
            question: 'Что интересно?',
            answers: [
              { answer: 'Фронтенд', answerCode: 'fe' },
              { answer: 'Бэкенд', answerCode: 'be' },
            ],
          },
          selectedAnswers: ['fe'],
          nextButton: 'next:qc1',
        }),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:fe',
      actor,
      fillSession(),
    );

    // Тоггл — тот же экран: без finalize, клавиатура жива
    expect(res.finalize).toBeUndefined();
    expect(res.screen?.keyboard).toBeDefined();
    expect(String(res.screen?.text)).toContain('\\[x\\]');
    expect(res.release).toBeUndefined();
    expect(res.awaitInput).toBeUndefined();
  });
});

// ══ awaitInput при входе в диалог ══

describe('FillStory — awaitInput при входе', () => {
  test('первый вопрос (без предыдущего): подсказка /cancel + awaitInput', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: radioQuestion,
          questionIndex: 1,
          poolSize: 3,
        }),
      },
    });

    const res = await story.handleCallback('current:q-1', actor, menuSession());

    expect(String(res.screen?.text)).toContain('/cancel');
    expect(res.awaitInput?.context).toEqual({ questionnaireId: 'q-1' });
  });

  test('не первый вопрос: без подсказки /cancel', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: nextTextQuestion,
          previousQuestion: radioQuestion,
          previousSelectedAnswers: ['novice'],
          questionIndex: 2,
          poolSize: 3,
        }),
      },
    });

    const res = await story.handleCallback('current:q-1', actor, menuSession());

    expect(String(res.screen?.text)).not.toContain('/cancel');
  });
});

// ══ Валидация — errorNotify (ввод живёт) ══

describe('FillStory — валидация ответов: errorNotify-переспрос', () => {
  test('текст при choice-вопросе (CHOICE_EXPECTED): warn «Ошибка валидации», экран не трогаем, ввод живёт', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () =>
          refuse(
            QuestionnaireErrors.CHOICE_EXPECTED.code,
            QuestionnaireErrors.CHOICE_EXPECTED.kind,
            undefined,
            QuestionnaireErrors.CHOICE_EXPECTED.label,
          ),
      },
    });

    const res = await story.handleMessage(
      { type: 'message', text: 'какой-то текст', telegramId: 1 },
      actor,
      fillSession(),
    );

    expect(res.notify?.kind).toBe('warn');
    expect(res.notify?.text).toContain('Ожидался ответ с выбором');
    expect(res.notify?.text).toContain('Ошибка валидации');
    expect(res.screen).toBeUndefined();
    expect(res.finalize).toBeUndefined();
    // Переспрос: ввод НЕ отпущен
    expect(res.release).toBeUndefined();
    expect(res.awaitInput).toBeUndefined();
  });

  test('internal-ошибка UC: общая реплика без утечки деталей, ввод живёт', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () =>
          refuse(
            'INTERNAL',
            'internal',
            undefined,
            'секретная внутренняя деталь',
          ),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:novice',
      actor,
      fillSession(),
    );

    expect(res.notify?.kind).toBe('warn');
    expect(res.notify?.text).not.toContain('секретная');
    expect(res.release).toBeUndefined();
  });
});

// ══ stale_answer — warn-реплика без перерисовки ══

describe('FillStory — stale_answer: реплика поверх, экран и ввод не трогаем', () => {
  const mockLogger = useMockLogger();

  const staleResponse = (overrides: Record<string, unknown> = {}) => ({
    type: 'stale_answer',
    questionnaireId: 'q-1',
    question: radioQuestion,
    selectedAnswers: [],
    reason: 'stale_button',
    ...overrides,
  });

  test('stale_button: warn-реплика «относится к предыдущему вопросу», без перерисовки', async () => {
    const { story } = initStory(new FillStory(), {
      answers: { handleAction: () => staleResponse() },
    });

    const res = await story.handleCallback(
      'answer:q-1:alien',
      actor,
      fillSession(),
    );

    expect(res.notify?.kind).toBe('warn');
    expect(res.notify?.text).toContain('относится к предыдущему вопросу');
    expect(res.screen).toBeUndefined();
    expect(res.finalize).toBeUndefined();
    expect(res.release).toBeUndefined();
  });

  test('empty_selection: warn-реплика «выбери хотя бы один вариант»', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => staleResponse({ reason: 'empty_selection' }),
      },
    });

    const res = await story.handleCallback(
      'next:q-1:qc1',
      actor,
      fillSession(),
    );

    expect(res.notify?.kind).toBe('warn');
    expect(res.notify?.text).toContain('выбери хотя бы один вариант');
    expect(res.release).toBeUndefined();
  });

  test('наблюдаемость: logger.warn с нажатым значением, вопросом и причиной', async () => {
    const { story } = initStory(new FillStory(), {
      answers: { handleAction: () => staleResponse() },
    });

    await story.handleCallback('answer:q-1:alien', actor, fillSession());

    type WarnCall = [string, string, Record<string, unknown>];
    const staleWarns = (
      mockLogger.warn.mock.calls as unknown as WarnCall[]
    ).filter(
      ([source, message]) =>
        source === 'fill-story' && message.includes('Неактуальный ответ'),
    );
    expect(staleWarns).toHaveLength(1);
    const [source, message, meta] = staleWarns[0] as WarnCall;
    expect(source).toBe('fill-story');
    expect(message).toContain('Неактуальный ответ');
    expect(meta.pressed).toBe('alien');
    expect(meta.questionCode).toBe('qc1');
    expect(meta.reason).toBe('stale_button');
    expect(meta.questionnaireId).toBe('q-1');
  });
});

// ══ Шапка прогресса и «Далее» мультивыбора ══

describe('FillStory — шапка «Вопрос N из M»', () => {
  test('new_question: шапка с индексом и размером пула', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: radioQuestion,
          questionIndex: 2,
          poolSize: 5,
        }),
      },
    });

    const res = await story.handleCallback('current:q-1', actor, menuSession());

    expect(String(res.screen?.text)).toContain('Вопрос 2 из 5');
  });

  test('wait_next: прогресс тоже показывается', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({
          type: 'wait_next',
          questionnaireId: 'q-1',
          currentQuestion: {
            questionCode: 'qc1',
            type: 'choice' as const,
            multiple: true,
            question: 'Что интересно?',
            answers: [{ answer: 'Фронтенд', answerCode: 'fe' }],
          },
          selectedAnswers: ['fe'],
          nextButton: 'next:qc1',
          questionIndex: 1,
          poolSize: 3,
        }),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:fe',
      actor,
      fillSession(),
    );

    expect(String(res.screen?.text)).toContain('Вопрос 1 из 3');
  });
});

describe('FillStory — кнопка «Далее» мультивыбора', () => {
  const multiQ = {
    questionCode: 'qc1',
    type: 'choice' as const,
    multiple: true,
    question: 'Что интересно?',
    answers: [
      { answer: 'Фронтенд', answerCode: 'fe' },
      { answer: 'Бэкенд', answerCode: 'be' },
    ],
  };

  test('выбран хотя бы один вариант — «Далее» присутствует', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({
          type: 'wait_next',
          questionnaireId: 'q-1',
          currentQuestion: multiQ,
          selectedAnswers: ['fe'],
          nextButton: 'next:qc1',
        }),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:fe',
      actor,
      fillSession(),
    );

    const texts = res.screen?.keyboard?.rows.flat().map((b) => b.text);
    expect(texts).toContain('Далее -->');
  });

  test('все варианты сняты (пустой драфт) — «Далее» исчезает', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({
          type: 'wait_next',
          questionnaireId: 'q-1',
          currentQuestion: multiQ,
          selectedAnswers: [],
          nextButton: undefined,
        }),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:fe',
      actor,
      fillSession(),
    );

    const texts = res.screen?.keyboard?.rows.flat().map((b) => b.text);
    expect(texts).not.toContain('Далее -->');
  });
});

// ══ Подписки (вариант A: сервер только зовёт) ══

describe('FillStory — подписки вариант A (invite-канал)', () => {
  const logger = useMockLogger();
  const users = { [RESPONDENT_ID]: respondentProfile() };

  test('getEventSubscriptions: started, abandonWarning, continueInvite, abandoned', () => {
    const { story } = initStory(new FillStory());

    const names = story.getEventSubscriptions().map((s) => s.eventName);
    expect(names).toEqual(
      [
        QuestionnaireEvents.started,
        QuestionnaireEvents.abandonWarning,
        QuestionnaireEvents.continueInvite,
        QuestionnaireEvents.abandoned,
      ].map((e) => e.name),
    );
  });

  test('started с courseId: invite «заполнить анкету» с кнопкой-мостом resume, адрес — get-user по respondentId', async () => {
    const { story, sender, execute } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.started.name).handle(
      startedEvent({ ownerInfo: { courseId: 'course-1' } }),
    );

    expect(execute).toHaveBeenCalledWith('get-user', { uuid: RESPONDENT_ID });
    expect(sender.invite).toHaveBeenCalledTimes(1);
    const [telegramId, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { text: string; keyboard: { rows: { text: string; code: string }[][] } },
    ];
    expect(telegramId).toBe(456);
    expect(payload.text).toContain('Анкета');
    expect(payload.keyboard.rows.flat().map((b) => [b.text, b.code])).toEqual([
      ['▶️ Заполнить анкету', 'questionnaire:fill:resume:course-1'],
    ]);
  });

  test('started без courseId: notify-подсказка входа через меню', async () => {
    const { story, sender } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.started.name).handle(
      startedEvent({ ownerInfo: {} }),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).toHaveBeenCalledTimes(1);
    const [telegramId, payload] = sender.notify.mock.calls[0] as unknown as [
      number,
      { text: string },
    ];
    expect(telegramId).toBe(456);
    expect(payload.text).toContain('/start');
  });

  test('started: courseId не строка — как без courseId (notify)', async () => {
    const { story, sender } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.started.name).handle(
      startedEvent({ ownerInfo: { courseId: 42 } }),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).toHaveBeenCalledTimes(1);
  });

  test('started: профиля нет — тишина и warn', async () => {
    const { story, sender } = initStory(new FillStory(), { users: {} });

    await subscriptionOf(story, QuestionnaireEvents.started.name).handle(
      startedEvent(),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).not.toHaveBeenCalled();
    expect(
      warnsOf(logger, 'fill', 'профиль респондента не найден'),
    ).toHaveLength(1);
  });

  test('started: профиль без telegramId — тишина и warn', async () => {
    const { telegramId: _tg, ...noTelegram } = respondentProfile();
    const { story, sender } = initStory(new FillStory(), {
      users: { [RESPONDENT_ID]: noTelegram },
    });

    await subscriptionOf(story, QuestionnaireEvents.started.name).handle(
      startedEvent(),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).not.toHaveBeenCalled();
    expect(warnsOf(logger, 'fill', 'нет telegramId респондента')).toHaveLength(
      1,
    );
  });

  test('started: сбой get-user — тишина и warn, без падения', async () => {
    const { story, sender } = initStory(new FillStory(), {
      getUserFails: true,
    });

    await subscriptionOf(story, QuestionnaireEvents.started.name).handle(
      startedEvent(),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).not.toHaveBeenCalled();
    const warns = warnsOf(logger, 'fill', 'сбой чтения профиля');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[2]?.error).toContain('сбой get-user');
  });
});

// ══ Resume: фильтр активных standard-анкет ══

describe('FillStory — resume по курсу: фильтрация', () => {
  test('completed и likert-анкеты того же курса игнорируются', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getQuestionnairesByUser: () => [
          {
            kind: 'standard',
            status: 'completed',
            ownerInfo: { courseId: 'course-1' },
            uuid: 'q-done',
          },
          {
            kind: 'likert',
            status: 'in_progress',
            ownerInfo: { courseId: 'course-1' },
            uuid: 'q-likert',
          },
          {
            kind: 'standard',
            status: 'in_progress',
            ownerInfo: { courseId: 'course-2' },
            uuid: 'q-other',
          },
        ],
      },
    });

    const res = await story.handleCallback(
      'resume:course-1',
      actor,
      menuSession(),
    );

    // Ни одна не подошла — экран «не найдена»
    expect(String(res.screen?.text)).toContain('Анкета не найдена');
  });
});

// ══ Команда /cancel — подтверждение перед abandon ══

describe('FillStory — /cancel: подтверждение перед прерыванием', () => {
  test('активная fill: stop с confirm-экраном, abandon НЕ вызывается', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: {
        getCurrent: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: radioQuestion,
          cancelWarning: 'Данные не сохранятся.',
        }),
      },
    });

    const reaction = await story.handleCommand(
      { type: 'command', command: 'cancel', args: '', telegramId: 1 },
      actor,
      fillSession(),
    );

    expect(reaction.reaction).toBe('stop');
    const res = (reaction as { response: DialogResponse }).response;

    expect(String(res.screen?.text)).toContain(
      'Вы уверены, что хотите прервать анкету?',
    );
    expect(String(res.screen?.text)).toContain('Данные не сохранятся');

    const flat = res.screen?.keyboard?.rows.flat() ?? [];
    expect(flat.map((b) => [b.text, b.code])).toEqual([
      ['✅ Да, прервать', 'fill:cancel-confirm:q-1'],
      ['❌ Нет, продолжить', 'fill:current:q-1'],
    ]);

    // Прерывание — только после подтверждения: abandon не звали
    const ucNames = dispatchedOf(dispatch).map((c) => c.uc);
    expect(ucNames).not.toContain(AbandonUcDef.name);
  });

  test('get-current недоступен (анкеты нет): дефолтный сброс «Отменено. Наберите /start»', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () =>
          refuse(
            QuestionnaireErrors.NOT_FOUND.code,
            QuestionnaireErrors.NOT_FOUND.kind,
            { questionnaireId: 'q-1' },
            QuestionnaireErrors.NOT_FOUND.label,
          ),
      },
    });

    const reaction = await story.handleCommand(
      { type: 'command', command: 'cancel', args: '', telegramId: 1 },
      actor,
      fillSession(),
    );

    expect(reaction.reaction).toBe('stop');
    const res = (reaction as { response: DialogResponse }).response;
    expect(res.notify?.text).toContain('Отменено');
    expect(res.screen).toBeUndefined();
  });

  test('неактивная fill: pass без побочных действий', async () => {
    const { story, dispatch } = initStory(new FillStory());

    const reaction = await story.handleCommand(
      { type: 'command', command: 'cancel', args: '', telegramId: 1 },
      actor,
      menuSession(),
    );

    expect(reaction).toEqual({ reaction: 'pass' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  test('прочая команда (/help): pass — дефолт контракта U7BotUiStory', async () => {
    const { story } = initStory(new FillStory());

    const reaction = await story.handleCommand(
      { type: 'command', command: 'help', args: '', telegramId: 1 },
      actor,
      fillSession(),
    );

    expect(reaction).toEqual({ reaction: 'pass' });
  });
});

// ══ Callback cancel:{qId} — экран ошибки при отказе UC ══

describe('FillStory — cancel:{qId}: отказ getCurrent — экран ошибки', () => {
  test('отказ getCurrent: экран «⚠️ Анкета не найдена» с кнопкой «⬅️ Меню»', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () =>
          refuse(
            QuestionnaireErrors.NOT_FOUND.code,
            QuestionnaireErrors.NOT_FOUND.kind,
            { questionnaireId: 'q-1' },
            QuestionnaireErrors.NOT_FOUND.label,
          ),
      },
    });

    const res = await story.handleCallback('cancel:q-1', actor, fillSession());

    expect(String(res.screen?.text)).toContain('Анкета не найдена');
    expect(buttonsOf(res)).toEqual([['⬅️ Меню', 'app:main-menu']]);
  });
});
