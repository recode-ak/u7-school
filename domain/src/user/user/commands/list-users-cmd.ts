import * as v from 'valibot';
import type { User, UserArMeta } from '../entity';
import { RoleSchema } from '../roles';

/** Схема валидации команды списка пользователей */
export const ListUsersCmdSchema = v.object({
  limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 20),
  role: v.optional(RoleSchema),
  name: v.optional(v.string()),
  telegramId: v.optional(v.number()),
  sort: v.optional(
    v.pipe(v.string(), v.regex(/^(createdAt|name):(asc|desc)$/)),
    'createdAt:desc',
  ),
});

/** Входные данные команды списка пользователей */
export type ListUsersCmd = v.InferInput<typeof ListUsersCmdSchema>;

/** Отфильтрованный список пользователей */
export interface ListUsersResult {
  users: User[];
}

/** Мета команды списка пользователей */
export interface ListUsersCmdMeta {
  ucName: 'list-users';
  arMeta: UserArMeta;
  input: ListUsersCmd;
  output: ListUsersResult;
  errors: ListUsersCmdError;
  requiresAuth: false;
  type: 'query';
}

/** Ошибки команды списка пользователей */
export type ListUsersCmdError = never;
