import type { UserAr } from '@u7-scl/domain/user/contract';
import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { QuestionnaireAr } from './questionnaire.ar';

/** Субъект прав анкеты: вопросы ролей — у `UserAr` (D-69). */
type QuestionnaireSubject = Pick<ReadonlyAr<UserAr>, 'uuid' | 'isAdmin'>;

/** Контекст прав на анкету: анкета, над которой действие. */
export type QuestionnaireCtx = {
  readonly questionnaire: ReadonlyAr<QuestionnaireAr>;
};

/** Контекст прав на список анкет пользователя. */
export type QuestionnairesCtx = { readonly userId: string };

const hasRespondent = Rule.of<QuestionnaireSubject, unknown>({
  name: 'hasRespondent',
  label: 'Человек-респондент',
  denyMessage: 'Анкету можно запустить только за человека-респондента.',
  check: () => true,
});

const isRespondent = Rule.of<QuestionnaireSubject, QuestionnaireCtx>({
  name: 'isRespondent',
  label: 'Респондент анкеты',
  denyMessage: 'Нет доступа к анкете',
  check: (subject, ctx) => ctx.questionnaire.isOf(subject.uuid),
});

const isAdmin = Rule.of<QuestionnaireSubject, unknown>({
  name: 'isAdmin',
  label: 'Администратор',
  denyMessage: 'Недостаточно прав',
  check: (subject) => subject.isAdmin(),
});

const isSelf = Rule.of<QuestionnaireSubject, QuestionnairesCtx>({
  name: 'isSelf',
  label: 'Свой список',
  denyMessage: 'Нет доступа к списку анкет пользователя',
  check: (subject, ctx) => subject.uuid === ctx.userId,
});

/**
 * Права на анкеты. Запуск анкеты — только за человека-респондента;
 * читает и меняет анкету её респондент или администратор; список анкет
 * пользователя — сам пользователь или администратор.
 */
export const QuestionnairePolicy = PolicyDef.define({
  name: 'questionnaire',
  label: 'Права на анкеты',
  description:
    'Кто запускает анкету — человек-респондент; кто читает и меняет — респондент или администратор.',
  rules: {
    hasRespondent,
    isRespondent,
    isAdmin,
    canAccess: Rule.anyOf(
      {
        name: 'canAccess',
        label: 'Респондент или администратор',
        denyMessage: 'Нет доступа к анкете',
      },
      isRespondent,
      isAdmin,
    ),
    canListFor: Rule.anyOf(
      {
        name: 'canListFor',
        label: 'Свой список или администратор',
        denyMessage: 'Нет доступа к списку анкет пользователя',
      },
      isSelf,
      isAdmin,
    ),
  },
});
