import { describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import type { BotSession } from '@u7-scl/core/ui';
import {
  QuestionnaireErrors,
  QuestionnaireEvents,
} from '@u7-scl/domain/questionnaire/contract';
import { InviteStory } from './invite.story';
import {
  dispatchedOf,
  initStory,
  invitedEvent,
  invitedView,
  RESPONDENT_ID,
  refuse,
  respondentProfile,
  subscriptionOf,
} from './questionnaire-dmg.test-kit';

/**
 * Поведенческие тесты InviteStory на контракте «Диалог и Экран»:
 * старт заполнения через delegate в fill-стори (ввод анкеты адресуется
 * fill-диалогу), MarkdownV2-безопасность доменных текстов (инцидент
 * 2026-09-03), fallback-реплики.
 */
//
// ══ Помощники ══

const actor = { uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' } as User;

const session: BotSession = {
  dialog: { path: 'questionnaire/invite', seq: 3 },
};

const users = { [RESPONDENT_ID]: respondentProfile() };

/** Доменный текст со спецсимволами MarkdownV2 (инцидент 2026-09-03). */
const unsafeText = 'Иванов_Иван (senior). Backend / Node.js!';

// ══ Старт заполнения — delegate в fill ══

describe('InviteStory — invite:start: делегирование fill-стори', () => {
  test('start:q → start-by-invite + delegate fill:current:{qId} — ввод адресуется fill-диалогу', async () => {
    const { story, dispatch } = initStory(new InviteStory(), {
      answers: {
        startByInvite: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: { questionCode: 'qc1', type: 'text', question: 'О себе' },
        }),
      },
    });

    const res = await story.handleCallback('start:q-1', actor, session);

    expect(dispatchedOf(dispatch)).toEqual([
      { uc: 'startByInvite', input: { questionnaireId: 'q-1' } },
    ]);

    // Делегат строится cbFor: контроллер префиксует до dispatch
    expect(res.delegate?.path).toBe('fill:current:q-1');
  });

  test('start:q при недоступной анкете: экран ошибки с выходом в меню', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        startByInvite: () =>
          refuse(
            QuestionnaireErrors.NOT_IN_PROGRESS.code,
            QuestionnaireErrors.NOT_IN_PROGRESS.kind,
            undefined,
            QuestionnaireErrors.NOT_IN_PROGRESS.label,
          ),
      },
    });

    const res = await story.handleCallback('start:q-1', actor, session);

    expect(String(res.screen?.text)).toContain('Анкета уже завершена');
    const flat = res.screen?.keyboard?.rows.flat() ?? [];
    expect(flat.map((b) => [b.text, b.code])).toEqual([
      ['⬅️ Меню', 'app:main-menu'],
    ]);
  });
});

// ══ MarkdownV2-безопасность доменных текстов ══

describe('InviteStory — MarkdownV2-безопасность (инцидент 2026-09-03)', () => {
  test('подписка invited: текст с спецсимволами безопасен', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      users,
      answers: { getCurrent: () => invitedView({ inviteText: unsafeText }) },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent({ questionnaireId: 'q1' }),
    );

    const [telegramId, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { text: string },
    ];
    expect(telegramId).toBe(456);
    expect(payload.text).toContain('Иванов\\_Иван');
    expect(() => assertMarkdownV2Safe(payload.text)).not.toThrow();
  });

  test('invite:why: whyText с спецсимволами безопасен', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        getCurrent: () => ({
          type: 'invited',
          questionnaireId: 'q1',
          whyText: unsafeText,
        }),
      },
    });

    const res = await story.handleCallback('why:q1', actor, session);

    expect(res.screen?.text).toContain('Иванов\\_Иван');
    expect(() => assertMarkdownV2Safe(res.screen!.text)).not.toThrow();
  });

  test('invite:invite: повторный S01 с небезопасным inviteText', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        getCurrent: () => ({
          type: 'invited',
          questionnaireId: 'q1',
          inviteText: unsafeText,
        }),
      },
    });

    const res = await story.handleCallback('invite:q1', actor, session);

    expect(() => assertMarkdownV2Safe(res.screen!.text)).not.toThrow();
  });

  test('cancelWarning в confirm-экране пропуска (decline) безопасен', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        getCurrent: () => ({
          type: 'invited',
          questionnaireId: 'q1',
          cancelWarning: unsafeText,
        }),
      },
    });

    const res = await story.handleCallback('decline:q1', actor, session);

    expect(String(res.screen?.text)).toContain('Иванов\\_Иван');
    expect(() => assertMarkdownV2Safe(res.screen!.text)).not.toThrow();
  });
});

// ══ Fallback-реплики ══

describe('InviteStory — fallback-реплики при пустых текстах пула', () => {
  test('подписка: без inviteText — «Заполните, пожалуйста, анкету.»', async () => {
    const { story, sender } = initStory(new InviteStory(), {
      users,
      answers: { getCurrent: () => invitedView() },
    });

    await subscriptionOf(story, QuestionnaireEvents.invited.name).handle(
      invitedEvent({ questionnaireId: 'q1' }),
    );

    const [, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { text: string },
    ];
    expect(payload.text).toContain('Заполните, пожалуйста, анкету');
  });

  test('invite:why: без whyText — «Нет дополнительной информации.»', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        getCurrent: () => ({
          type: 'invited',
          questionnaireId: 'q1',
        }),
      },
    });

    const res = await story.handleCallback('why:q1', actor, session);

    expect(String(res.screen?.text)).toContain('Нет дополнительной информации');
  });
});
