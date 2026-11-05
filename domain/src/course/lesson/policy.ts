import type { User } from '@u7-scl/domain/user';
import { UserPolicy } from '@u7-scl/domain/user';
import type { Module } from '../module/entity';
import { LegacyModulePolicy } from '../module/policy';
import { Status } from '../status';
import type { Lesson } from './entity';

/**
 * Политика прав доступа для уроков.
 * Получает Course для самостоятельной проверки авторства через LegacyModulePolicy.
 */
export const LegacyLessonPolicy = {
  canCreate(actor: User): boolean {
    return UserPolicy.isAuthor(actor);
  },

  /** Читать: ADMIN/автор курса → всё; иначе PUBLISHED. */
  canRead(actor: User, target: Lesson, module: Module): boolean {
    return (
      LegacyModulePolicy.isAdminOrAuthor(actor, module) ||
      this.isPublished(target)
    );
  },

  /** Редактировать: только ADMIN или автор курса. */
  canEdit(actor: User, _target: Lesson, module: Module): boolean {
    return LegacyModulePolicy.isAdminOrAuthor(actor, module);
  },

  isPublished(lesson: Lesson): boolean {
    return lesson.status === Status.PUBLISHED;
  },
};
