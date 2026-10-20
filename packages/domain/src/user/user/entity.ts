import * as v from 'valibot';
import { RoleSchema } from './roles';

// ══ Сущность пользователя ══

/**
 * Каноническая схема пользователя платформы.
 * Владелец — домен user (перенесено из app, там остался реэкспорт — D-4):
 * core/api специализируется этим типом актора.
 */
export const UserSchema = v.object({
  uuid: v.pipe(v.string(), v.uuid('Некорректный формат UUID')),
  name: v.pipe(v.string(), v.trim(), v.nonEmpty('Имя не может быть пустым')),
  telegramId: v.pipe(
    v.number(),
    v.integer('telegramId должен быть целым числом'),
    v.minValue(1, 'telegramId должен быть положительным'),
  ),
  roles: v.pipe(
    v.array(RoleSchema),
    v.minLength(1, 'Пользователь должен иметь хотя бы одну роль'),
  ),
  // biome-ignore lint/plugin: перенос без изменения схем (ISO-даты — DEBT-5)
  createdAt: v.pipe(v.string(), v.isoDateTime('Некорректный формат даты')),
  updatedAt: v.optional(
    // biome-ignore lint/plugin: перенос без изменения схем (ISO-даты — DEBT-5)
    v.pipe(v.string(), v.isoDateTime('Некорректный формат даты')),
  ),
  nick: v.optional(
    v.pipe(v.string(), v.trim(), v.nonEmpty('Ник не может быть пустым')),
  ),
});

/** Тип пользователя, выведенный из схемы валидации */
export type User = v.InferOutput<typeof UserSchema>;

/** Метаданные агрегата пользователя */
export interface UserArMeta {
  name: 'User';
  label: 'Пользователь';
  errors: never;
  state: User;
}
