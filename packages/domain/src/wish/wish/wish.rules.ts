import type {
  CourseEnrollment,
  ModuleEnrollment,
} from '@u7-scl/domain/course/contract';
import { defineRules, domainRule, err, ok, type ReadonlyAr } from 'dmg-core';
import type { CreateWish, WishAr } from './wish.ar';
import { WishErrors } from './wish.errors';

/**
 * Контекст правила уникальности: кто и на какую цель выражает желание
 * и желания, загруженные UC (любой набор, например все желания пользователя).
 * Цель — из входа Ar, а не из state (DOM-01).
 */
export type UniqueWishCtx = {
  readonly userId: string;
  readonly target: CreateWish['target'];
  readonly wishes: readonly ReadonlyAr<WishAr>[];
};

/**
 * Не более одного активного желания на пару (user, target) — доменное
 * правило без субъекта (D-40). Правило само отбирает желания этого
 * `userId` на эту `target` и не доверяет фильтру вызывающего. Нужны **все**
 * такие желания (не «последнее»): при равных `createdAt` активное может
 * оказаться не первым. Отказ строит существующее желание — со своим
 * статусом, по нему ветвится UI (D-39).
 */
const unique = domainRule({
  name: 'unique',
  label: 'Одно активное желание на цель',
  description:
    'Новое желание выражается, только если у пользователя нет активного (expressed | pending | confirmed) желания на тот же курс или модуль.',
  error: WishErrors.ALREADY_EXISTS,
  check: ({ userId, target, wishes }: UniqueWishCtx) => {
    const active = wishes.find(
      (wish) => wish.isOwnedBy(userId) && wish.isFor(target) && wish.isActive(),
    );
    return active === undefined ? ok() : err(active.alreadyExists());
  },
});

/**
 * Контекст допуска курса: курс из входа и ответ модуля курсов о записи
 * на него (UC `getCourseEnrollment`, D-42) — делегирование минимумом.
 */
export type CourseEnrollableCtx = {
  readonly courseId: string;
  readonly enrollment: CourseEnrollment;
};

/**
 * Желание на курс выражается, только если курс открыт для записи — допуск
 * без субъекта (D-40). Решает модуль курсов (`enrollable`); здесь — перевод
 * его ответа в ошибку желаний: «недоступен для записи» для студента
 * неотличим от «нет курса» (`WISH_COURSE_NOT_FOUND`).
 */
const courseEnrollable = domainRule({
  name: 'courseEnrollable',
  label: 'Курс открыт для записи',
  description:
    'Желание пройти курс выражается, только если курс доступен для записи: опубликован, не в архиве и со стартовым модулем.',
  error: WishErrors.COURSE_NOT_FOUND,
  check: ({ courseId, enrollment }: CourseEnrollableCtx) =>
    enrollment.enrollable
      ? ok()
      : WishErrors.COURSE_NOT_FOUND.err({ courseId }),
});

/**
 * Контекст допуска модуля: модуль из входа и ответ модуля курсов о записи
 * на него (UC `getModuleEnrollment`).
 */
export type ModuleEnrollableCtx = {
  readonly moduleId: string;
  readonly enrollment: ModuleEnrollment;
};

/**
 * Желание на модуль выражается, только если модуль входит в программу
 * опубликованного курса — допуск без субъекта (D-40). Решает модуль курсов
 * (`enrollable`); здесь — перевод ответа в `WISH_MODULE_NOT_FOUND`.
 */
const moduleEnrollable = domainRule({
  name: 'moduleEnrollable',
  label: 'Модуль открыт для записи',
  description:
    'Желание пройти модуль выражается, только если модуль входит в программу опубликованного курса.',
  error: WishErrors.MODULE_NOT_FOUND,
  check: ({ moduleId, enrollment }: ModuleEnrollableCtx) =>
    enrollment.enrollable
      ? ok()
      : WishErrors.MODULE_NOT_FOUND.err({ moduleId }),
});

export const WishRules = defineRules({
  name: 'wish',
  label: 'Правила желаний',
  description:
    'Допустимость действий с желаниями при текущих состояниях желаний пользователя.',
  rules: { courseEnrollable, moduleEnrollable, unique },
});
