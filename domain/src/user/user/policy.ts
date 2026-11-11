import type { User } from './entity';
import { Role } from './roles';

/**
 * Политика прав доступа для пользователей.
 * Stateless — проверяет права на основе роли действующего пользователя.
 */
export const LegacyUserPolicy = {
  isAdmin(actor: User): boolean {
    return actor.roles.includes(Role.ADMIN);
  },

  isMentor(actor: User): boolean {
    return actor.roles.includes(Role.MENTOR);
  },

  isAuthor(actor: User): boolean {
    return actor.roles.includes(Role.AUTHOR);
  },

  canCreate(actor: User): boolean {
    return this.isAdmin(actor);
  },

  /** Добавлять роли может только ADMIN. */
  canAddRole(actor: User): boolean {
    return this.isAdmin(actor);
  },

  /** Снимать роли может только ADMIN. */
  canRemoveRole(actor: User): boolean {
    return this.isAdmin(actor);
  },
};
