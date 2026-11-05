import { describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import { AbandonUcDef } from '@u7-scl/domain/questionnaire/contract';
import { FillStory } from './fill.story';
import {
  buttonsOf,
  completedView,
  dispatchedOf,
  initStory,
  newQuestionView,
  refuse,
  useMockLogger,
} from './questionnaire-dmg.test-kit';

/**
 * Вызовы UC модуля анкет из FillStory через `dispatchUc` (`command.uc` и
 * `input`) и ветвление по отказу `Result`: в ветках ввода (ответ, «Далее»,
 * текст) любой отказ — `ucErrorNotify` (warn, в том числе «Ошибка
 * валидации» + label для choice/пустого ответа), вопрос остаётся на экране;
 * в ветках навигации — экран с «⬅️ Меню»; `/cancel` при отказе —
 * «Отменено…». Ветвление по `code`/`kind`, не по тексту.
 */

const actor = { uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' } as User;

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

function menuSession(): BotSession {
  return { dialog: { path: 'app/menu', seq: 2 } };
}

const MENU_ROW = [['⬅️ Меню', 'app:main-menu']];
/** Штатный экран v0.2.6 — кнопка `buttons.mainMenu()`. */
const MAIN_MENU_ROW = [['↩️ Главное меню', 'app:main-menu']];

describe('FillStory — вызовы UC через dispatchUc', () => {
  test('answer:{qId}:{aCode} → handleAction callback с кодом ответа, субъект — актор', async () => {
    const callers: string[] = [];
    const { story, dispatch } = initStory(new FillStory(), {
      answers: {
        handleAction: (_input, caller) => {
          callers.push(caller.subject().uuid);
          return newQuestionView();
        },
      },
    });

    await story.handleCallback('answer:q-1:novice', actor, fillSession());

    expect(dispatchedOf(dispatch)).toEqual([
      {
        uc: 'handleAction',
        input: { questionnaireId: 'q-1', type: 'callback', value: 'novice' },
      },
    ]);
    expect(callers).toEqual([actor.uuid]);
  });

  test('next:{qId}:{qCode} → handleAction callback со значением next:{qCode}', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: { handleAction: () => newQuestionView() },
    });

    await story.handleCallback('next:q-1:qc1', actor, fillSession());

    expect(dispatchedOf(dispatch)).toEqual([
      {
        uc: 'handleAction',
        input: { questionnaireId: 'q-1', type: 'callback', value: 'next:qc1' },
      },
    ]);
  });

  test('текстовое сообщение → handleAction text с текстом ответа', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: { handleAction: () => completedView() },
    });

    await story.handleMessage(
      { type: 'message', text: '3 года фронтенда', telegramId: 1 },
      actor,
      fillSession(),
    );

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
  });

  test('current:{qId} → getCurrent, вопрос на экране и ввод захвачен', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: { getCurrent: () => newQuestionView() },
    });

    const res = await story.handleCallback('current:q-1', actor, menuSession());

    expect(dispatchedOf(dispatch)).toEqual([
      { uc: 'getCurrent', input: { questionnaireId: 'q-1' } },
    ]);
    expect(String(res.screen?.text)).toContain('Расскажи о себе');
    expect(res.awaitInput).toEqual({ context: { questionnaireId: 'q-1' } });
  });

  test('resume:{courseId} → getQuestionnairesByUser {userId: актор}, затем getCurrent найденной анкеты', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: {
        getQuestionnairesByUser: () => [
          {
            kind: 'standard',
            status: 'completed',
            ownerInfo: { courseId: 'course-1' },
            uuid: 'q-done',
          },
          {
            kind: 'standard',
            status: 'in_progress',
            ownerInfo: { courseId: 'course-1' },
            uuid: 'q-active',
          },
        ],
        getCurrent: () => newQuestionView({ questionnaireId: 'q-active' }),
      },
    });

    const res = await story.handleCallback(
      'resume:course-1',
      actor,
      menuSession(),
    );

    expect(dispatchedOf(dispatch)).toEqual([
      { uc: 'getQuestionnairesByUser', input: { userId: actor.uuid } },
      { uc: 'getCurrent', input: { questionnaireId: 'q-active' } },
    ]);
    expect(res.awaitInput).toEqual({
      context: { questionnaireId: 'q-active' },
    });
  });

  test('cancel-confirm:{qId} → abandon {questionnaireId}, «Анкета прервана» и release', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: { abandon: () => ({}) },
    });

    const res = await story.handleCallback(
      'cancel-confirm:q-1',
      actor,
      fillSession(),
    );

    expect(dispatchedOf(dispatch)).toEqual([
      { uc: AbandonUcDef.name, input: { questionnaireId: 'q-1' } },
    ]);
    expect(String(res.screen?.text)).toContain('Анкета прервана');
    expect(res.release).toBe(true);
  });

  test('cancel:{qId} → getCurrent для confirm-экрана, abandon не вызывается', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: {
        getCurrent: () => newQuestionView({ cancelWarning: 'Не сохранится.' }),
      },
    });

    const res = await story.handleCallback('cancel:q-1', actor, fillSession());

    expect(dispatchedOf(dispatch).map((c) => c.uc)).toEqual(['getCurrent']);
    expect(String(res.screen?.text)).toContain('Не сохранится');
  });
});

describe('FillStory — отказы handleAction: реплика поверх, ввод живёт', () => {
  const logger = useMockLogger();

  test('CHOICE_EXPECTED: warn «Ошибка валидации» с текстом отказа', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () =>
          refuse(
            'QUESTIONNAIRE_CHOICE_EXPECTED',
            'validation',
            {},
            'Ожидался ответ с выбором (нажатием кнопки)',
          ),
      },
    });

    const res = await story.handleMessage(
      { type: 'message', text: 'текст', telegramId: 1 },
      actor,
      fillSession(),
    );

    expect(res.notify?.kind).toBe('warn');
    expect(String(res.notify?.text)).toContain(
      'Ожидался ответ с выбором \\(нажатием кнопки\\)',
    );
    expect(String(res.notify?.text)).toContain('Ошибка валидации');
    expect(res.screen).toBeUndefined();
    expect(res.release).toBeUndefined();
  });

  test('EMPTY_ANSWER_CODE: warn «Ошибка валидации» с текстом отказа', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () =>
          refuse(
            'QUESTIONNAIRE_EMPTY_ANSWER_CODE',
            'validation',
            {},
            'Код ответа не может быть пустым',
          ),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:x',
      actor,
      fillSession(),
    );

    expect(res.notify?.kind).toBe('warn');
    expect(String(res.notify?.text)).toContain(
      'Код ответа не может быть пустым',
    );
    expect(String(res.notify?.text)).toContain('Ошибка валидации');
  });

  test('NOT_IN_PROGRESS: warn с label, экран не трогаем', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () =>
          refuse(
            'QUESTIONNAIRE_NOT_IN_PROGRESS',
            'conflict',
            {},
            'Анкета уже завершена',
          ),
      },
    });

    const res = await story.handleCallback(
      'next:q-1:qc1',
      actor,
      fillSession(),
    );

    expect(res.notify?.kind).toBe('warn');
    expect(String(res.notify?.text)).toContain('Анкета уже завершена');
    expect(res.screen).toBeUndefined();
  });

  test('access: warn с denyMessage правила', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () =>
          refuse(
            'ACCESS_DENIED',
            'access',
            { denyMessage: 'Нет доступа к анкете' },
            'Доступ запрещён',
          ),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:x',
      actor,
      fillSession(),
    );

    expect(String(res.notify?.text)).toContain('Нет доступа к анкете');
  });

  test('internal: общая реплика без утечки деталей, ввод живёт', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () =>
          refuse('INTERNAL', 'internal', {}, 'секретная внутренняя деталь'),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:x',
      actor,
      fillSession(),
    );

    expect(res.notify?.kind).toBe('warn');
    expect(String(res.notify?.text)).not.toContain('секретная');
    expect(res.release).toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('FillStory — отказы экранных веток: ucErrorScreen с «⬅️ Меню»', () => {
  test('current: NOT_FOUND → «⚠️ Анкета не найдена» и кнопка меню', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () =>
          refuse(
            'QUESTIONNAIRE_NOT_FOUND',
            'not_found',
            {},
            'Анкета не найдена',
          ),
      },
    });

    const res = await story.handleCallback('current:q-1', actor, menuSession());

    expect(String(res.screen?.text)).toContain('Анкета не найдена');
    expect(buttonsOf(res)).toEqual(MENU_ROW);
    expect(res.awaitInput).toBeUndefined();
  });

  test('resume: getQuestionnairesByUser отказал (access) → denyMessage и меню', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getQuestionnairesByUser: () =>
          refuse(
            'ACCESS_DENIED',
            'access',
            { denyMessage: 'Нет доступа к списку анкет пользователя' },
            'Доступ запрещён',
          ),
      },
    });

    const res = await story.handleCallback(
      'resume:course-1',
      actor,
      menuSession(),
    );

    expect(String(res.screen?.text)).toContain(
      'Нет доступа к списку анкет пользователя',
    );
    expect(buttonsOf(res)).toEqual(MENU_ROW);
  });

  test('resume: нет подходящей анкеты → «Анкета не найдена или уже завершена» и меню', async () => {
    const { story } = initStory(new FillStory(), {
      answers: { getQuestionnairesByUser: () => [] },
    });

    const res = await story.handleCallback(
      'resume:course-1',
      actor,
      menuSession(),
    );

    expect(String(res.screen?.text)).toContain(
      'Анкета не найдена или уже завершена',
    );
    expect(buttonsOf(res)).toEqual(MAIN_MENU_ROW);
  });

  test('cancel-confirm: NOT_ACTIVE → экран ошибки с меню, без release', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        abandon: () =>
          refuse(
            'QUESTIONNAIRE_NOT_ACTIVE',
            'conflict',
            {},
            'Анкета не активна',
          ),
      },
    });

    const res = await story.handleCallback(
      'cancel-confirm:q-1',
      actor,
      fillSession(),
    );

    expect(String(res.screen?.text)).toContain('Анкета не активна');
    expect(buttonsOf(res)).toEqual(MENU_ROW);
    expect(res.release).toBeUndefined();
  });

  test('internal: общий текст без утечки label, кнопка меню', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () =>
          refuse('INTERNAL', 'internal', {}, 'секретная внутренняя деталь'),
      },
    });

    const res = await story.handleCallback('current:q-1', actor, menuSession());

    expect(String(res.screen?.text)).not.toContain('секретная');
    expect(buttonsOf(res)).toEqual(MENU_ROW);
  });
});

describe('FillStory — /cancel через dispatchUc', () => {
  test('активная fill: getCurrent → confirm-экран, abandon не вызывается', async () => {
    const { story, dispatch } = initStory(new FillStory(), {
      answers: { getCurrent: () => newQuestionView() },
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
    expect(dispatchedOf(dispatch)).toEqual([
      { uc: 'getCurrent', input: { questionnaireId: 'q-1' } },
    ]);
  });

  test('getCurrent отказал → «Отменено. Наберите /start» без экрана', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () =>
          refuse(
            'QUESTIONNAIRE_NOT_FOUND',
            'not_found',
            {},
            'Анкета не найдена',
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
    expect(String(res.notify?.text)).toContain('Отменено');
    expect(res.screen).toBeUndefined();
  });

  test('неактивная fill: pass, UC не вызываются', async () => {
    const { story, dispatch } = initStory(new FillStory());

    const reaction = await story.handleCommand(
      { type: 'command', command: 'cancel', args: '', telegramId: 1 },
      actor,
      menuSession(),
    );

    expect(reaction).toEqual({ reaction: 'pass' });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
