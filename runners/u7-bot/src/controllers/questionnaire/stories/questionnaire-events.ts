import type { DomainEvent } from '@u7-scl/core/domain';
import type { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import type * as v from 'valibot';

/**
 * События анкеты в форме, как их доставляет `legacyEventBus`: `eventName` —
 * FQN Def, `payload` — по схеме события (без адреса: telegramId бот берёт
 * по профилю респондента).
 */
type QuestionnaireEventOf<
  E extends { name: string; payload: v.GenericSchema },
> = DomainEvent & {
  eventName: E['name'];
  payload: v.InferOutput<E['payload']>;
};

export type QuestionnaireStartedEvent = QuestionnaireEventOf<
  typeof QuestionnaireEvents.started
>;
export type QuestionnaireInvitedEvent = QuestionnaireEventOf<
  typeof QuestionnaireEvents.invited
>;
export type QuestionnaireAbandonWarningEvent = QuestionnaireEventOf<
  typeof QuestionnaireEvents.abandonWarning
>;
export type QuestionnaireContinueInviteEvent = QuestionnaireEventOf<
  typeof QuestionnaireEvents.continueInvite
>;
export type QuestionnaireAbandonedEvent = QuestionnaireEventOf<
  typeof QuestionnaireEvents.abandoned
>;
