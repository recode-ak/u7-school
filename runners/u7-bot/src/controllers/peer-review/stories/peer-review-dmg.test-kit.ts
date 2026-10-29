import { expect, mock } from 'bun:test';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review/contract';
import { type Command, ok, UserCaller } from 'dmg-core';

/** Отказ UC в моке: ответ-значение, которое `peerReviewDispatch` превращает в `err`. */
export class Refusal {
  constructor(
    readonly error: { code: string; kind: string; payload?: unknown },
  ) {}
}

/** Отказ домена с кодом (`Result.err`) вместо успешного ответа. */
export const refuse = (code: string, kind = 'conflict', payload?: unknown) =>
  new Refusal({ code, kind, payload });

/** Ответы UC модуля peer-review (DMG) в моках stories: вход → значение. */
export interface PeerReviewAnswers {
  getMyCampaigns?: (input: unknown) => unknown;
  getCampaignRecipients?: (input: unknown) => unknown;
  createReview?: (input: unknown) => unknown;
  getMyReview?: (input: unknown) => unknown;
  listMyReviews?: (input: unknown) => unknown;
  listScopeReviews?: (input: unknown) => unknown;
  listScopeFacts?: (input: unknown) => unknown;
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
    const value = answer(command.input);
    return value instanceof Refusal
      ? { ok: false as const, error: value.error }
      : ok(value);
  });
}

/** Резолвер `Caller` приложения (D-50) для `dispatchUc` stories. */
export const testCallers = {
  resolve: async (uuid: string | undefined) =>
    new UserCaller({ uuid } as never),
};
