import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Роль пользователя. `STUDENT` держится до Ф3: фикстуры и живые записи его
 * содержат, строгий разбор без него уронил бы их.
 */
export const UserRoleName = F.picklist(
  ['GUEST', 'SUBSCRIBER', 'STUDENT', 'MENTOR', 'AUTHOR', 'ADMIN'],
  'Роль пользователя',
);

/** Роль пользователя платформы. */
export type UserRole = v.InferOutput<typeof UserRoleName>;

/**
 * Текст пользователя: края обрезаются. Описание стоит до преобразования —
 * JSON Schema (`toJsonSchema`) обрывается на первом `transform`.
 */
const trimmed = (label: string) =>
  v.pipe(
    v.string(),
    v.description(label),
    v.transform((value) => value.trim()),
    v.nonEmpty(`${label} не может быть пустым`),
  );

/**
 * Entity пользователя — единственное место структуры состояния. Legacy-записи
 * читаются: ISO-даты → число (UTC), нет `updatedAt` → `createdAt`, нет
 * `version` → 0 (D-36).
 */
export const UserState = v.object({
  ...BaseEntityFields,
  name: trimmed('Имя пользователя'),
  telegramId: v.pipe(
    F.int('telegramId пользователя'),
    v.minValue(1, 'telegramId должен быть положительным'),
  ),
  roles: v.pipe(
    v.array(UserRoleName),
    v.description('Роли пользователя в порядке выдачи'),
    v.minLength(1, 'Пользователь должен иметь хотя бы одну роль'),
  ),
  nick: v.optional(trimmed('Ник в Telegram')),
});

export type UserState = v.InferOutput<typeof UserState>;
