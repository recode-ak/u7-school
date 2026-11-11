import { describe, expect, test } from 'bun:test';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import { FillStory } from './fill.story';
import {
  abandonedEvent,
  abandonWarningEvent,
  continueInviteEvent,
  initStory,
  RESPONDENT_ID,
  respondentProfile,
  subscriptionOf,
  userReadsOf,
} from './questionnaire-dmg.test-kit';

/**
 * Проактивные события FillStory на контракте «Диалог и Экран»:
 * abandonWarning (S07, ступень 6ч) и continueInvite (S09, ступень 3ч) —
 * кнопочный проактив ТОЛЬКО каналом invite (ФР-6, «никогда срезка в notify»),
 * полные коды кнопок (транспорт проактивы не префиксует), прерывание — через
 * confirm-экран. abandoned (S08) — notify только при reason='timeout'.
 * Адрес события не несёт: telegramId — по профилю респондента (`getUser`).
 */

const users = { [RESPONDENT_ID]: respondentProfile() };

describe('FillStory — abandonWarning (S07): invite-канал', () => {
  test('с courseId: «Продолжить» (мост resume) и «Прервать» (confirm)', async () => {
    const { story, sender, dispatch } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.abandonWarning.name).handle(
      abandonWarningEvent({ ownerInfo: { courseId: 'course-1' } }),
    );

    expect(userReadsOf(dispatch)).toEqual([RESPONDENT_ID]);
    expect(sender.invite).toHaveBeenCalledTimes(1);
    const [telegramId, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { text: string; keyboard: { rows: { text: string; code: string }[][] } },
    ];
    expect(telegramId).toBe(456);

    expect(payload.text).toContain('Анкета приостановлена');
    expect(payload.text).toContain('Скоро она будет закрыта');
    expect(() => assertMarkdownV2Safe(payload.text)).not.toThrow();

    expect(payload.keyboard.rows.flat().map((b) => [b.text, b.code])).toEqual([
      ['▶️ Продолжить', 'questionnaire:fill:resume:course-1'],
      ['⏭️ Прервать', 'questionnaire:fill:cancel:q-1'],
    ]);
  });

  test('без courseId — кнопка только «Прервать»', async () => {
    const { story, sender } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.abandonWarning.name).handle(
      abandonWarningEvent({ ownerInfo: {} }),
    );

    const [, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { keyboard: { rows: { text: string; code: string }[][] } },
    ];
    expect(payload.keyboard.rows.flat().map((b) => [b.text, b.code])).toEqual([
      ['⏭️ Прервать', 'questionnaire:fill:cancel:q-1'],
    ]);
  });
});

describe('FillStory — abandoned (S08): notify о закрытии по таймауту', () => {
  test('reason=timeout — notify без кнопок', async () => {
    const { story, sender } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.abandoned.name).handle(
      abandonedEvent({ reason: 'timeout' }),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).toHaveBeenCalledTimes(1);
    const [telegramId, payload] = sender.notify.mock.calls[0] as unknown as [
      number,
      { text: string },
    ];
    expect(telegramId).toBe(456);
    expect(payload.text).toContain('длительной неактивности');
    expect(() => assertMarkdownV2Safe(payload.text)).not.toThrow();
  });

  test.each(['by_user', 'declined'] as const)(
    'reason=%s — дубля нет, ничего не шлём',
    async (reason) => {
      const { story, sender } = initStory(new FillStory(), { users });

      await subscriptionOf(story, QuestionnaireEvents.abandoned.name).handle(
        abandonedEvent({ reason }),
      );

      expect(sender.notify).not.toHaveBeenCalled();
      expect(sender.invite).not.toHaveBeenCalled();
    },
  );
});

describe('FillStory — continueInvite (S09): invite-канал', () => {
  test('сообщение «продолжим?» с кнопками «Продолжить анкету» и «Прервать»', async () => {
    const { story, sender } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.continueInvite.name).handle(
      continueInviteEvent({ ownerInfo: { courseId: 'course-1' } }),
    );

    expect(sender.invite).toHaveBeenCalledTimes(1);
    const [telegramId, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { text: string; keyboard: { rows: { text: string; code: string }[][] } },
    ];
    expect(telegramId).toBe(456);

    expect(payload.text).toContain('продолжим?');
    expect(() => assertMarkdownV2Safe(payload.text)).not.toThrow();

    expect(payload.keyboard.rows.flat().map((b) => [b.text, b.code])).toEqual([
      ['▶️ Продолжить анкету', 'questionnaire:fill:resume:course-1'],
      ['⏭️ Прервать', 'questionnaire:fill:cancel:q-1'],
    ]);
  });

  test('без courseId — кнопки-моста нет, только «Прервать»', async () => {
    const { story, sender } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.continueInvite.name).handle(
      continueInviteEvent({ ownerInfo: {} }),
    );

    const [, payload] = sender.invite.mock.calls[0] as unknown as [
      number,
      { keyboard: { rows: { text: string; code: string }[][] } },
    ];
    expect(payload.keyboard.rows.flat().map((b) => [b.text, b.code])).toEqual([
      ['⏭️ Прервать', 'questionnaire:fill:cancel:q-1'],
    ]);
  });
});
