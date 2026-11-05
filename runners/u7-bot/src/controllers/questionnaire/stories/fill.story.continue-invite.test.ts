import { describe, expect, test } from 'bun:test';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import { FillStory } from './fill.story';
import {
  continueInviteEvent,
  initStory,
  RESPONDENT_ID,
  respondentProfile,
  subscriptionOf,
  useMockLogger,
} from './questionnaire-dmg.test-kit';

/**
 * Подписка continueInvite (S09, ступень 3ч планировщика) на контракте
 * «Диалог и Экран»: канал invite (ФР-6), кнопки-мосты с ПОЛНЫМИ кодами,
 * подсказка /start, прерывание — через confirm. Адрес — профиль
 * респондента (`get-user`), событие его не несёт.
 */

const users = { [RESPONDENT_ID]: respondentProfile() };

describe('FillStory — continueInvite (S09): invite-канал', () => {
  const logger = useMockLogger();

  test('подписка зарегистрирована', () => {
    const { story } = initStory(new FillStory());
    const names = story.getEventSubscriptions().map((s) => s.eventName);
    expect(names).toContain(QuestionnaireEvents.continueInvite.name);
  });

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

  test('нет адреса (профиля нет) — тишина и warn', async () => {
    const { story, sender } = initStory(new FillStory(), { users: {} });

    await subscriptionOf(story, QuestionnaireEvents.continueInvite.name).handle(
      continueInviteEvent(),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
