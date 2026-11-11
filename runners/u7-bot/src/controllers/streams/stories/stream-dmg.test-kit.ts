import { expect, mock } from 'bun:test';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { type Command, ok } from 'dmg-core';

/** Отказ UC в моке: ответ-значение, которое `dmgDispatch` превращает в `err`. */
export class Refusal {
  constructor(
    readonly error: {
      code: string;
      kind: string;
      label: string;
      payload?: unknown;
    },
  ) {}
}

/** Отказ домена с кодом (`Result.err`) вместо успешного ответа. */
export const refuse = (
  code: string,
  kind = 'conflict',
  payload?: unknown,
  label = code,
) => new Refusal({ code, kind, label, payload });

/** Ответы UC модулей DMG в моках stories: имя UC → (вход) → значение. */
export type UcAnswers = Record<
  string,
  (input: unknown, caller: { subject(): { uuid: string } }) => unknown
>;

/**
 * Мок `appApi.dispatch`: команда отвечает `ok(...)` по имени UC; UC без
 * ответа — ошибка теста. `modules` — допустимые модули (по умолчанию —
 * `stream` и `peer-review`).
 */
export function dmgDispatch(
  answers: UcAnswers,
  modules: readonly unknown[] = [
    StreamModuleDef,
    PeerReviewModuleDef,
    UserModuleDef,
  ],
) {
  return mock(
    async (
      module: unknown,
      command: Command,
      caller: { subject(): { uuid: string } },
    ) => {
      expect(modules).toContain(module);
      const answer = answers[command.uc];
      if (!answer) throw new Error(`Нет ответа на UC DMG: ${command.uc}`);
      const value = answer(command.input, caller);
      return value instanceof Refusal
        ? { ok: false as const, error: value.error }
        : ok(value);
    },
  );
}

/** Отказ «поток не найден» — как у `getStream` модуля потоков. */
export const streamNotFound = () =>
  refuse('STREAM_NOT_FOUND', 'not_found', {}, 'Поток не найден');

/** Ответ `getStream` по умолчанию: поток в наборе без кодового слова, управлять им нельзя. */
export const streamView = (overrides: Record<string, unknown> = {}) => ({
  uuid: '11111111-1111-4111-8111-111111111111',
  schoolId: 'school-1',
  title: 'Поток «JS Core — Поток 2»',
  description: 'Базовый поток по fullstack JS',
  status: 'enrollment',
  startDate: Date.parse('2026-10-01T10:00:00.000Z'),
  mentorId: 'm1-m1-m1',
  moduleId: 'mod-1',
  contentSnapshot: [],
  requiresEnrollmentKey: false,
  canManage: false,
  createdAt: Date.parse('2026-01-01T00:00:00.000Z'),
  updatedAt: Date.parse('2026-01-01T00:00:00.000Z'),
  version: 0,
  ...overrides,
});
