import { describe, expect, test } from 'bun:test';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import { FillStory } from './fill.story';
import {
  abandonedEvent,
  abandonWarningEvent,
  initStory,
  RESPONDENT_ID,
  respondentProfile,
  subscriptionOf,
  useMockLogger,
} from './questionnaire-dmg.test-kit';

/**
 * Подписка abandonWarning (S07, ступень 6ч планировщика) и abandoned (S08)
 * на контракте «Диалог и Экран»: кнопочный проактив — ТОЛЬКО канал invite
 * (ФР-6, «никогда срезка в notify»), полные коды кнопок (транспорт проактивы
 * не префиксует), подсказка /start на случай устаревшего экрана. Прерывание —
 * через confirm-экран (fill:cancel), не сразу abandon. Адрес события не
 * несёт: telegramId — по профилю респондента (`get-user`).
 */

const users = { [RESPONDENT_ID]: respondentProfile() };

describe('FillStory — abandonWarning (S07): invite-канал', () => {
  const logger = useMockLogger();

  test('подписки включают abandonWarning и abandoned', () => {
    const { story } = initStory(new FillStory());
    const names = story.getEventSubscriptions().map((s) => s.eventName);
    expect(names).toContain(QuestionnaireEvents.abandonWarning.name);
    expect(names).toContain(QuestionnaireEvents.abandoned.name);
  });

  test('с courseId: кнопки «Продолжить» (мост resume) и «Прервать» (confirm), подсказка /start', async () => {
    const { story, sender, execute } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.abandonWarning.name).handle(
      abandonWarningEvent({ ownerInfo: { courseId: 'course-1' } }),
    );

    expect(execute).toHaveBeenCalledWith('get-user', { uuid: RESPONDENT_ID });
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

  test('нет адреса (профиля нет) — тишина и warn', async () => {
    const { story, sender } = initStory(new FillStory(), { users: {} });

    await subscriptionOf(story, QuestionnaireEvents.abandonWarning.name).handle(
      abandonWarningEvent(),
    );

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('FillStory — abandoned (S08): notify о закрытии по таймауту', () => {
  const logger = useMockLogger();

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

  test('reason=by_user (ручное прерывание) — дубля нет, ничего не шлём', async () => {
    const { story, sender } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.abandoned.name).handle(
      abandonedEvent({ reason: 'by_user' }),
    );

    expect(sender.notify).not.toHaveBeenCalled();
    expect(sender.invite).not.toHaveBeenCalled();
  });

  test('reason=declined (отказ от приглашения) — ничего не шлём', async () => {
    const { story, sender } = initStory(new FillStory(), { users });

    await subscriptionOf(story, QuestionnaireEvents.abandoned.name).handle(
      abandonedEvent({ reason: 'declined' }),
    );

    expect(sender.notify).not.toHaveBeenCalled();
    expect(sender.invite).not.toHaveBeenCalled();
  });

  test('timeout без адреса (профиля нет) — слать некому, warn', async () => {
    const { story, sender } = initStory(new FillStory(), { users: {} });

    await subscriptionOf(story, QuestionnaireEvents.abandoned.name).handle(
      abandonedEvent({ reason: 'timeout' }),
    );

    expect(sender.notify).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
