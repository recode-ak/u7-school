import type { DomainEvent } from '@u7-scl/core/domain';
import type {
  InviteResponse,
  QuestionnaireActionResponse,
} from '@u7-scl/domain/questionnaire/contract';

// Временные типы legacy-событий анкет для stories: подписки и вызовы `execute`
// на legacy-именах переводит на контракт Ф2, тогда файл удаляется.

type BasePayload = {
  questionnaireId: string;
  respondentId: string;
};

/** Событие запуска анкеты (`questionnaire:start`). */
export interface QuestionnaireStartEvent extends DomainEvent {
  eventName: 'questionnaire:start';
  aggregateName: 'Questionnaire';
  ownerInfo: Record<string, unknown>;
  payload: BasePayload & {
    telegramId: number;
    response: QuestionnaireActionResponse;
  };
}

/** Событие приглашения на анкету (`questionnaire:invite`). */
export interface QuestionnaireInviteEvent extends DomainEvent {
  eventName: 'questionnaire:invite';
  aggregateName: 'Questionnaire';
  ownerInfo: Record<string, unknown>;
  payload: BasePayload & {
    telegramId: number;
    response: InviteResponse;
  };
}

/** Предупреждение о закрытии брошенной анкеты (`questionnaire:abandon-warning`). */
export interface QuestionnaireAbandonWarningEvent extends DomainEvent {
  eventName: 'questionnaire:abandon-warning';
  aggregateName: 'Questionnaire';
  ownerInfo: Record<string, unknown>;
  payload: BasePayload & { telegramId: number };
}

/** Приглашение продолжить брошенную анкету (`questionnaire:continue-invite`). */
export interface QuestionnaireContinueInviteEvent extends DomainEvent {
  eventName: 'questionnaire:continue-invite';
  aggregateName: 'Questionnaire';
  ownerInfo: Record<string, unknown>;
  payload: BasePayload & { telegramId: number };
}

/** Прерывание анкеты (`questionnaire:abandon`). */
export interface QuestionnaireAbandonEvent extends DomainEvent {
  eventName: 'questionnaire:abandon';
  aggregateName: 'Questionnaire';
  ownerInfo: Record<string, unknown>;
  payload: BasePayload & {
    reason?: 'timeout' | 'by_user';
    telegramId?: number;
  };
}
