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

  /**
   * ADMIN может добавлять любую роль любому пользователю.
   * MENTOR может добавить роль STUDENT любому пользователю.
   * Обычный пользователь — роль STUDENT самому себе.
   */
  canAddRole(actor: User, target: User, role: Role): boolean {
    if (this.isAdmin(actor)) return true;
    if (this.isMentor(actor) && role === Role.STUDENT) return true;
    if (actor.uuid !== target.uuid) return false;
    return role === Role.STUDENT;
  },
  /**
   * ADMIN может удалять любую роль у любого пользователя.
   * MENTOR может снять роль STUDENT у любого пользователя.
   * Обычный пользователь — роль STUDENT у самого себя.
   */
  canRemoveRole(actor: User, target: User, role: Role): boolean {
    if (this.isAdmin(actor)) return true;
    if (this.isMentor(actor) && role === Role.STUDENT) return true;
    if (actor.uuid !== target.uuid) return false;
    return role === Role.STUDENT;
  },
};
