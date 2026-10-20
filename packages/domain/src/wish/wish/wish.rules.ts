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

export const WishRules = defineRules({
  name: 'wish',
  label: 'Правила желаний',
  description:
    'Допустимость действий с желаниями при текущих состояниях желаний пользователя.',
  rules: { unique },
});
