import type { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import type { EnvelopeOf } from 'dmg-core/app';

/**
 * События анкеты — конверты DMG, `payload` — по схеме события (без адреса:
 * telegramId бот берёт по профилю респондента).
 */
export type QuestionnaireStartedEvent = EnvelopeOf<
  typeof QuestionnaireEvents.started
>;
export type QuestionnaireInvitedEvent = EnvelopeOf<
  typeof QuestionnaireEvents.invited
>;
export type QuestionnaireAbandonWarningEvent = EnvelopeOf<
  typeof QuestionnaireEvents.abandonWarning
>;
export type QuestionnaireContinueInviteEvent = EnvelopeOf<
  typeof QuestionnaireEvents.continueInvite
>;
export type QuestionnaireAbandonedEvent = EnvelopeOf<
  typeof QuestionnaireEvents.abandoned
>;
