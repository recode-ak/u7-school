import { expect, mock } from 'bun:test';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review/contract';
import { type Command, ok, UserCaller } from 'dmg-core';

/** Ответы UC модуля peer-review (DMG) в моках stories: вход → значение. */
export interface PeerReviewAnswers {
  getMyCampaigns?: (input: unknown) => unknown;
  getCampaignRecipients?: (input: unknown) => unknown;
}

/**
 * Мок `appApi.dispatch`: команда модулю peer-review отвечает `ok(...)` по
 * имени UC; чужой модуль или UC без ответа — ошибка теста.
 */
export function peerReviewDispatch(answers: PeerReviewAnswers) {
  return mock(async (module: unknown, command: Command) => {
    expect(module).toBe(PeerReviewModuleDef);
    const answer = answers[command.uc as keyof PeerReviewAnswers];
    if (!answer) throw new Error(`Нет ответа на UC DMG: ${command.uc}`);
    return ok(answer(command.input));
  });
}

/** Резолвер `Caller` приложения (D-50) для `dispatchUc` stories. */
export const testCallers = {
  resolve: async (uuid: string | undefined) =>
    new UserCaller({ uuid } as never),
};
