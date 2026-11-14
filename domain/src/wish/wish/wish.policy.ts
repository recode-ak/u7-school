import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { WishAr } from './wish.ar';

/** Контекст правил желания: желание, над которым действие. */
export type WishCtx = { readonly wish: ReadonlyAr<WishAr> };

const isAuthor = Rule.of({
  name: 'isAuthor',
  label: 'Автор желания',
  denyMessage: 'Отменить желание может только его автор.',
  check: (subject: { readonly uuid: string }, ctx: WishCtx) =>
    ctx.wish.isOwnedBy(subject.uuid),
});

/**
 * Права на желания. Создание — без правила: желание всегда выражается
 * за вызывающего (`userId` берётся из субъекта, не из входа), поэтому UC
 * создания ссылаются на `allowAll`. Уникальность активного желания —
 * не право, а доменное правило: `WishRules.rules.unique` (D-40).
 */
export const WishPolicy = PolicyDef.define({
  name: 'wish',
  label: 'Права на желания',
  description: 'Кто может управлять желанием: только его автор.',
  rules: {
    canCancel: isAuthor,
  },
});
