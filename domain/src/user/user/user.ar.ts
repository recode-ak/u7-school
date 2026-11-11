import {
  Aggregate,
  AggregateDef,
  ok,
  type Result,
  type Timestamp,
} from 'dmg-core';
import type * as v from 'valibot';
import { UserErrors } from './user.errors';
import { type UserRole, UserState } from './user.state';

/**
 * Def агрегата пользователя: жизненного цикла нет, событий нет (потребителей
 * нет, MAN-06).
 */
export const UserArDef = AggregateDef.define({
  name: 'user',
  label: 'Пользователь',
  description: 'Учётная запись пользователя школы: профиль и роли.',
  state: UserState,
  events: {},
  errors: UserErrors,
});

/**
 * Пользователь наружу: форма state — даты числами, `version` включена.
 * Отдельного вида нет, `view()` не переопределяется.
 */
export const UserView = UserState;

export type UserView = v.InferOutput<typeof UserView>;

/** Вход создания: поля state, которые задаёт вызывающий; роль — всегда гость. */
export type CreateUser = Omit<
  UserState,
  'roles' | 'createdAt' | 'updatedAt' | 'version'
>;

/**
 * Агрегат User — учётная запись и её роли.
 *
 * Новый пользователь — гость; роли добавляются и снимаются идемпотентно, без
 * роли пользователь не остаётся (возвращается `GUEST`).
 */
export class UserAr extends Aggregate<typeof UserArDef, UserView> {
  private constructor(state: UserState) {
    super(UserArDef, state);
  }

  /** Новый гость: роль `GUEST`, пустой ник не записывается. */
  static create(input: CreateUser, at: Timestamp): Result<UserAr, never> {
    const state: UserState = {
      ...UserAr.newState(input.uuid, at),
      name: input.name,
      telegramId: input.telegramId,
      roles: ['GUEST'],
    };
    if (input.nick !== undefined && input.nick.trim() !== '') {
      state.nick = input.nick;
    }
    return ok(new UserAr(state));
  }

  /** Восстановление из хранилища — запись разобрана `UserArDef.state`. */
  static restore(snapshot: UserState): UserAr {
    return new UserAr(snapshot);
  }

  // ── Вопросы ──

  /** Есть ли у пользователя роль. */
  hasRole(role: UserRole): boolean {
    return this.state.roles.includes(role);
  }

  /** Администратор платформы. */
  isAdmin(): boolean {
    return this.hasRole('ADMIN');
  }

  /** Наставник. */
  isMentor(): boolean {
    return this.hasRole('MENTOR');
  }

  // ── Мутации ──

  /** Добавление роли; роль уже есть — ничего не меняется. */
  addRole(role: UserRole, at: Timestamp): Result<void, never> {
    if (this.hasRole(role)) return ok();
    return this.change(at, (draft) => {
      draft.roles.push(role);
      return ok();
    });
  }

  /**
   * Снятие роли; роли нет — ничего не меняется. Последняя снятая роль
   * оставляет `GUEST` — без роли пользователь не остаётся.
   */
  removeRole(role: UserRole, at: Timestamp): Result<void, never> {
    if (!this.hasRole(role)) return ok();
    return this.change(at, (draft) => {
      const rest = draft.roles.filter((mine) => mine !== role);
      draft.roles = rest.length === 0 ? ['GUEST'] : rest;
      return ok();
    });
  }
}
