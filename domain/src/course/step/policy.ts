import type { User } from '@u7-scl/domain/user';
import { UserPolicy } from '@u7-scl/domain/user';
import type { Module } from '../module/entity';
import { LegacyModulePolicy } from '../module/policy';
import { Status } from '../status';
import type { Step } from './entity';

/**
 * Политика прав доступа для шагов.
 * Получает Course для самостоятельной проверки авторства через LegacyModulePolicy.
 */
export const LegacyStepPolicy = {
  canCreate(actor: User): boolean {
    return UserPolicy.isAuthor(actor);
  },

  /** Читать: ADMIN/автор курса → всё; иначе PUBLISHED. */
  canRead(actor: User, target: Step, module: Module): boolean {
    return (
      LegacyModulePolicy.isAdminOrAuthor(actor, module) ||
      target.status === Status.PUBLISHED
    );
  },

  /** Редактировать: только ADMIN или автор курса. */
  canEdit(actor: User, _target: Step, module: Module): boolean {
    return LegacyModulePolicy.isAdminOrAuthor(actor, module);
  },
};
