import { PolicyDef, Rule } from 'dmg-core';

/**
 * Субъект прав пользователя — ответ на вопрос «администратор ли он»:
 * агрегат пользователя, `ReadonlyAr` которого видит чужой код (D-69).
 */
type UserSubject = { isAdmin(): boolean };

const isAdmin = (subject: UserSubject) => subject.isAdmin();

const canRegisterGuest = Rule.of({
  name: 'canRegisterGuest',
  label: 'Администратор регистрирует гостей',
  denyMessage: 'Только администратор может регистрировать гостей',
  check: isAdmin,
});

const canManageRoles = Rule.of({
  name: 'canManageRoles',
  label: 'Администратор управляет ролями',
  denyMessage: 'Недостаточно прав для выполнения действия',
  check: isAdmin,
});

/**
 * Права на пользователей: роли выдаёт и гостей регистрирует только
 * администратор — исключения `STUDENT` из legacy не переносятся.
 * Чтение открыто всем — `allowAll` в Def UC.
 */
export const UserPolicy = PolicyDef.define({
  name: 'user',
  label: 'Права на пользователей',
  description:
    'Кто регистрирует гостей и управляет ролями — администратор платформы.',
  rules: {
    canRegisterGuest,
    canManageRoles,
  },
});
