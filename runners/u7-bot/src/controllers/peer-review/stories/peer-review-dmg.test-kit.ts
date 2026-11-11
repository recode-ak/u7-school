import { expect, mock } from 'bun:test';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
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

/** Ответы UC DMG в моках stories (peer-review и чтение потока): вход → значение. */
export interface PeerReviewAnswers {
  getMyCampaigns?: (input: unknown) => unknown;
  getCampaignRecipients?: (input: unknown) => unknown;
  createReview?: (input: unknown) => unknown;
  getMyReview?: (input: unknown) => unknown;
  listMyReviews?: (input: unknown) => unknown;
  listScopeReviews?: (input: unknown) => unknown;
  listScopeFacts?: (input: unknown) => unknown;
  getStream?: (input: unknown) => unknown;
  listStreams?: (input: unknown) => unknown;
  /** Профили `user`: `getUser` по uuid, `getUsersByIds` пачкой. */
  getUser?: (input: unknown) => unknown;
  getUsersByIds?: (input: unknown) => unknown;
}

/**
 * Мок `appApi.dispatch`: команда модулю peer-review, потоков или `user` отвечает
 * `ok(...)` по имени UC; чужой модуль или UC без ответа — ошибка теста.
 */
export function peerReviewDispatch(answers: PeerReviewAnswers) {
  return mock(async (module: unknown, command: Command) => {
    expect(
      module === PeerReviewModuleDef ||
        module === StreamModuleDef ||
        module === UserModuleDef,
    ).toBe(true);
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
