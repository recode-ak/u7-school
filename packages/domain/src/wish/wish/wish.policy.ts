import { definePolicy, type ReadonlyAr, rule } from 'dmg-core';
import type { WishAr } from './wish.ar';

/** Контекст правил желания: желание, над которым действие. */
export type WishCtx = { readonly wish: ReadonlyAr<WishAr> };

const isAuthor = rule({
  name: 'isAuthor',
  label: 'Автор желания',
  denyMessage: 'Отменить желание может только его автор.',
  check: (subject: { readonly uuid: string }, ctx: WishCtx) =>
    ctx.wish.isOwnedBy(subject.uuid),
});

/**
 * Права на желания. Создание — без правила: желание всегда выражается
 * за вызывающего (`userId` берётся из субъекта, не из входа), поэтому с Ф8
 * (`defineUseCase`) UC создания сошлются на `allowAll`; сейчас legacy-UC
 * без Policy. Уникальность активного желания —
 * не право, а доменное решение: `WishDcs.checkUnique`.
 */
export const WishPolicy = definePolicy({
  name: 'wish',
  label: 'Права на желания',
  description: 'Кто может управлять желанием: только его автор.',
  rules: {
    canCancel: isAuthor,
  },
});
