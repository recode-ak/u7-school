import { F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Исход судьбы студента — 4-значная проекция (ФР-1):
 * завершил и прошел / завершил и не прошел / забросил / не начал.
 * «Ещё учится» не хранится вовсе; сырые статусы студента сюда не попадают.
 * Общая для кампании и рецензии (снапшот исхода автора).
 */
export const StudentOutcomeSchema = F.picklist(
  ['completed_passed', 'completed_not_passed', 'dropped', 'never_started'],
  'исход судьбы студента',
);

export type StudentOutcome = v.InferOutput<typeof StudentOutcomeSchema>;

/** Контекст кампании — дискриминант payload. Окно судьбы студента потока. */
export const CampaignContextSchema = F.picklist(
  ['stream_fate'],
  'контекст кампании',
);

export type CampaignContext = v.InferOutput<typeof CampaignContextSchema>;

/** Роль автора окна судьбы: субъект или его ментор. */
export const CampaignAuthorRoleSchema = F.picklist(
  ['subject', 'mentor'],
  'роль автора окна: субъект или его ментор',
);

export type CampaignAuthorRole = v.InferOutput<typeof CampaignAuthorRoleSchema>;

/**
 * Момент времени на выходе (UC, payload ошибок): строго число — мс от эпохи,
 * UTC. Для чтения записей — `F.timestamp`.
 */
export const epochMsField = (label: string) =>
  v.pipe(v.number(), v.integer(), v.description(`Время ${label} (мс, UTC)`));
