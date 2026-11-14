import type { UserAr } from '@u7-scl/domain/user/contract';
import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { ModuleAr } from './module.ar';

/** Субъект прав модуля: вопросы ролей — у `UserAr` (D-69). */
type ModuleSubject = Pick<ReadonlyAr<UserAr>, 'uuid' | 'isAdmin' | 'isMentor'>;

/** Контекст прав на модуль: модуль, над которым действие. */
export type ModuleCtx = { readonly module: ReadonlyAr<ModuleAr> };

const isAdmin = Rule.of({
  name: 'isAdmin',
  label: 'Администратор',
  denyMessage: 'Нет доступа к модулю',
  check: (subject: ModuleSubject) => subject.isAdmin(),
});

const isMentor = Rule.of({
  name: 'isMentor',
  label: 'Ментор',
  denyMessage: 'Нет доступа к модулю',
  check: (subject: ModuleSubject) => subject.isMentor(),
});

const isModuleAuthor = Rule.of({
  name: 'isModuleAuthor',
  label: 'Автор модуля',
  denyMessage: 'Нет доступа к модулю',
  check: (subject: ModuleSubject, ctx: ModuleCtx) =>
    ctx.module.isAuthoredBy(subject.uuid),
});

/**
 * Права на модули. Чтение открыто всем — `allowAll` в Def UC; неопубликованное
 * видят администратор, любой ментор (роль) и автор модуля (роль `AUTHOR` не
 * требуется).
 */
export const ModulePolicy = PolicyDef.define({
  name: 'module',
  label: 'Права на модули',
  description:
    'Кто видит неопубликованный модуль — администратор, ментор и автор модуля.',
  rules: {
    canSeeUnpublished: Rule.anyOf(
      {
        name: 'canSeeUnpublished',
        label: 'Администратор, ментор или автор модуля',
        denyMessage: 'Нет доступа к модулю',
      },
      isAdmin,
      isMentor,
      isModuleAuthor,
    ),
  },
});
