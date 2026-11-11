import { describe, expect, test } from 'bun:test';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import type { BotSession } from '@u7-scl/core/ui';
import {
  QuestionnaireErrors,
  QuestionnaireEvents,
} from '@u7-scl/domain/questionnaire/contract';
import { userActor } from '../../../core/user-actor.test-kit';
import { InviteStory } from './invite.story';
import {
  buttonsOf,
  dispatchedOf,
  initStory,
  invitedEvent,
  invitedView,
  newQuestionView,
  RESPONDENT_ID,
  refuse,
  respondentProfile,
  subscriptionOf,
  useMockLogger,
  userReadsOf,
  warnsOf,
} from './questionnaire-dmg.test-kit';

/**
 * Вызовы UC модуля анкет из InviteStory через `dispatchUc`, отказы с экраном
 * «⬅️ Меню» и подписка `invited`: текст приглашения берётся из `getCurrent`
 * от имени респондента (событие экран не несёт). Доменные тексты
 * (`whyText`, `cancelWarning`) экранируются под MarkdownV2 (инцидент
 * 2026-09-03).
 */

const actor = userActor({
  uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  roles: ['GUEST'],
});
const session: BotSession = {
  dialog: { path: 'questionnaire/invite', seq: 3 },
};
const MENU_ROW = [['⬅️ Меню', 'app:main-menu']];
const users = { [RESPONDENT_ID]: respondentProfile() };
const unsafeText = 'Иванов_Иван (senior). Backend / Node.js!';

const notFound = () =>
  refuse('QUESTIONNAIRE_NOT_FOUND', 'not_found', {}, 'Анкета не найдена');

describe('InviteStory — вызовы UC через dispatchUc', () => {
  test('start:{qId} → startByInvite {questionnaireId}, делегат fill:current:{qId}', async () => {
    const callers: string[] = [];
    const { story, dispatch } = initStory(new InviteStory(), {
      answers: {
        startByInvite: (_input, caller) => {
          callers.push(caller.subject().uuid);
          return newQuestionView();
        },
      },
    });

    const res = await story.handleCallback('start:q-1', actor, session);

    expect(dispatchedOf(dispatch)).toEqual([
      { uc: 'startByInvite', input: { questionnaireId: 'q-1' } },
    ]);
    expect(callers).toEqual([actor.user.uuid]);
    expect(res.delegate?.path).toBe('fill:current:q-1');
  });

  test('start:{qId}: отказ startByInvite → экран ошибки с «⬅️ Меню», без делегата', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        startByInvite: () =>
          refuse(
            QuestionnaireErrors.NOT_INVITED.code,
            QuestionnaireErrors.NOT_INVITED.kind,
            undefined,
            QuestionnaireErrors.NOT_INVITED.label,
          ),
      },
    });

    const res = await story.handleCallback('start:q-1', actor, session);

    expect(res.delegate).toBeUndefined();
    expect(String(res.screen?.text)).toContain('Анкета не в статусе invited');
    expect(buttonsOf(res)).toEqual(MENU_ROW);
  });

  test('why:{qId} → getCurrent, whyText на экране', async () => {
    const { story, dispatch } = initStory(new InviteStory(), {
      answers: { getCurrent: () => invitedView({ whyText: 'Для обучения' }) },
    });

    const res = await story.handleCallback('why:q-1', actor, session);

    expect(dispatchedOf(dispatch)).toEqual([
      { uc: 'getCurrent', input: { questionnaireId: 'q-1' } },
    ]);
    expect(String(res.screen?.text)).toContain('Для обучения');
  });

  test('why:{qId}: getCurrent не invited — «Нет дополнительной информации»', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: { getCurrent: () => newQuestionView() },
    });

    const res = await story.handleCallback('why:q-1', actor, session);

    expect(String(res.screen?.text)).toContain('Нет дополнительной информации');
  });

  test('invite:{qId} → getCurrent, повторный S01', async () => {
    const { story, dispatch } = initStory(new InviteStory(), {
      answers: {
        getCurrent: () =>
          invitedView({ inviteText: 'Заполните анкету', whyText: 'Зачем' }),
      },
    });

    const res = await story.handleCallback('invite:q-1', actor, session);

    expect(dispatchedOf(dispatch).map((c) => c.uc)).toEqual(['getCurrent']);
    expect(String(res.screen?.text)).toContain('Заполните анкету');
  });

  test('decline:{qId} → getCurrent для confirm-экрана пропуска', async () => {
    const { story, dispatch } = initStory(new InviteStory(), {
      answers: { getCurrent: () => invitedView({ cancelWarning: 'Жаль.' }) },
    });

    const res = await story.handleCallback('decline:q-1', actor, session);

    expect(dispatchedOf(dispatch).map((c) => c.uc)).toEqual(['getCurrent']);
    expect(String(res.screen?.text)).toContain('Вы уверены');
    expect(String(res.screen?.text)).toContain('Жаль');
  });

  test('decline-confirm:{qId} → declineInvite {questionnaireId}, «Анкета пропущена» и release', async () => {
    const { story, dispatch } = initStory(new InviteStory(), {
      answers: { declineInvite: () => ({}) },
    });

    const res = await story.handleCallback(
      'decline-confirm:q-1',
      actor,
      session,
    );

    expect(dispatchedOf(dispatch)).toEqual([
      { uc: 'declineInvite', input: { questionnaireId: 'q-1' } },
    ]);
    expect(String(res.screen?.text)).toContain('Анкета пропущена');
    expect(res.release).toBe(true);
  });
});

describe('InviteStory — отказы: ucErrorScreen с «⬅️ Меню»', () => {
  test.each([
    ['why:q-1', 'getCurrent'],
    ['invite:q-1', 'getCurrent'],
    ['decline:q-1', 'getCurrent'],
  ])('%s: NOT_FOUND → «Анкета не найдена» и меню', async (action, uc) => {
    const { story } = initStory(new InviteStory(), {
      answers: { [uc]: notFound },
    });

    const res = await story.handleCallback(action, actor, session);

    expect(String(res.screen?.text)).toContain('Анкета не найдена');
    expect(buttonsOf(res)).toEqual(MENU_ROW);
  });

  test('decline-confirm: NOT_INVITED → текст отказа и меню, без release', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        declineInvite: () =>
          refuse(
            'QUESTIONNAIRE_NOT_INVITED',
            'conflict',
            {},
            'Анкета не в статусе invited, невозможно запустить или отказаться',
          ),
      },
    });

    const res = await story.handleCallback(
      'decline-confirm:q-1',
      actor,
      session,
    );

    expect(String(res.screen?.text)).toContain('Анкета не в статусе invited');
    expect(buttonsOf(res)).toEqual(MENU_ROW);
    expect(res.release).toBeUndefined();
  });
});

describe('InviteStory — подписка invited: экран из getCurrent', () => {
  const logger = useMockLogger();

  test('getCurrent вызывается от имени респондента, адрес — getUser', async () => {
    const callers: string[] = [];
    const { story, dispatch, sender } = initStory(new InviteStory(), {
      users,
      answers: {
        getCurrent: (_input, caller) => {
          callers.push(caller.subject().uuid);
          return invitedView({ inviteText: 'Заполните анкету' });
        },
      },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent(),
    );

    expect(userReadsOf(dispatch)).toEqual([RESPONDENT_ID]);
    expect(dispatchedOf(dispatch)).toEqual([
      { uc: 'getCurrent', input: { questionnaireId: 'q-1' } },
    ]);
    expect(callers).toEqual([RESPONDENT_ID]);
    expect(sender.invite).toHaveBeenCalledTimes(1);
    expect(sender.invite.mock.calls[0]?.[0]).toBe(456);
  });

  test('inviteText и whyText из ответа: «Зачем» в кнопках, текст MarkdownV2-безопасен', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      users,
      answers: {
        getCurrent: () =>
          invitedView({ inviteText: unsafeText, whyText: unsafeText }),
      },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent(),
    );

    const [, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { text: string; keyboard: { rows: { text: string; code: string }[][] } },
    ];
    expect(payload.text).toContain('Иванов\\_Иван');
    expect(() => assertMarkdownV2Safe(payload.text)).not.toThrow();
    expect(payload.keyboard.rows.flat().map((b) => b.code)).toEqual([
      'questionnaire:invite:start:q-1',
      'questionnaire:invite:why:q-1',
      'questionnaire:invite:decline:q-1',
    ]);
  });

  test('без whyText — кнопки «Зачем» нет', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      users,
      answers: { getCurrent: () => invitedView({ inviteText: 'Текст' }) },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent(),
    );

    const [, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { keyboard: { rows: { text: string; code: string }[][] } },
    ];
    expect(payload.keyboard.rows.flat().map((b) => b.text)).toEqual([
      '▶️ Начать заполнение',
      '⏭️ Пропустить',
    ]);
  });

  test('без inviteText — fallback «Заполните, пожалуйста, анкету.»', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      users,
      answers: { getCurrent: () => invitedView() },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent(),
    );

    const [, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { text: string },
    ];
    expect(payload.text).toContain('Заполните, пожалуйста, анкету');
  });

  test('getCurrent вернул не invited — fallback без «Зачем» и warn', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      users,
      answers: { getCurrent: () => newQuestionView() },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent(),
    );

    const [, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { text: string; keyboard: { rows: { text: string; code: string }[][] } },
    ];
    expect(payload.text).toContain('Заполните, пожалуйста, анкету');
    expect(payload.keyboard.rows.flat().map((b) => b.text)).toEqual([
      '▶️ Начать заполнение',
      '⏭️ Пропустить',
    ]);
    const warns = warnsOf(logger, 'invite', 'Тексты приглашения недоступны');
    expect(warns).toHaveLength(1);
  });

  test('getCurrent отказал — fallback без «Зачем» и warn, приглашение уходит', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      users,
      answers: { getCurrent: () => notFound() },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent(),
    );

    expect(sender.invite).toHaveBeenCalledTimes(1);
    const [, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { text: string },
    ];
    expect(payload.text).toContain('Заполните, пожалуйста, анкету');
    const warns = warnsOf(logger, 'invite', 'Тексты приглашения недоступны');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[2]?.refusal).toBe('QUESTIONNAIRE_NOT_FOUND');
  });

  test('профиля нет — тишина и warn', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      users: {},
      answers: { getCurrent: () => invitedView() },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent(),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).not.toHaveBeenCalled();
    expect(
      warnsOf(logger, 'invite', 'профиль респондента не найден'),
    ).toHaveLength(1);
  });

  test('Err getUser, кроме USER_NOT_FOUND — тишина и warn «сбой чтения профиля»', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      answers: {
        getUser: () => refuse('CORE_INTERNAL', 'internal'),
        getCurrent: () => invitedView(),
      },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent(),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).not.toHaveBeenCalled();
    expect(warnsOf(logger, 'invite', 'сбой чтения профиля')).toHaveLength(1);
    expect(
      warnsOf(logger, 'invite', 'профиль респондента не найден'),
    ).toHaveLength(0);
  });

  test('сбой getUser — тишина и warn с причиной', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      getUserFails: true,
      answers: { getCurrent: () => invitedView() },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent(),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).not.toHaveBeenCalled();
    const warns = warnsOf(logger, 'invite', 'сбой чтения профиля');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[2]?.error).toContain('сбой getUser');
  });
});

describe('InviteStory — MarkdownV2-безопасность доменных текстов', () => {
  test.each([
    ['whyText', 'why:q1', { whyText: unsafeText }],
    ['cancelWarning', 'decline:q1', { cancelWarning: unsafeText }],
  ] as const)('%s с спецсимволами безопасен', async (_field, action, view) => {
    const { story } = initStory(new InviteStory(), {
      answers: { getCurrent: () => invitedView(view) },
    });

    const res = await story.handleCallback(action, actor, session);

    expect(res.screen?.text).toContain('Иванов\\_Иван');
    expect(() => assertMarkdownV2Safe(res.screen!.text)).not.toThrow();
  });
});
