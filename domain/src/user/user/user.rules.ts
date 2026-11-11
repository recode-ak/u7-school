import { DomainRuleDef, ok, type ReadonlyAr, RulesDef } from 'dmg-core';
import type { UserAr } from './user.ar';
import { UserErrors } from './user.errors';

/** Контекст правила: пользователь, занявший telegramId, если такой есть. */
export type TelegramIdFreeCtx = {
  readonly holder?: ReadonlyAr<UserAr>;
};

/**
 * Гостя регистрируют на свободный telegramId — допуск без субъекта (D-40).
 * Держателя ищет UC (`load`) и кладёт в контекст: правило отвечает только по
 * найденной записи и само её telegramId отдаёт в ошибку.
 */
const telegramIdFree = DomainRuleDef.define({
  name: 'telegramIdFree',
  label: 'Telegram ID свободен',
  description:
    'Регистрация гостя возможна, только если этот telegramId ещё не занят другим пользователем.',
  error: UserErrors.TELEGRAM_ID_TAKEN,
  check: ({ holder }: TelegramIdFreeCtx) =>
    holder === undefined
      ? ok()
      : UserErrors.TELEGRAM_ID_TAKEN.err({
          telegramId: holder.view().telegramId,
        }),
});

export const UserRules = RulesDef.define({
  name: 'user',
  label: 'Правила пользователей',
  description:
    'Допустимость действий с пользователем при занятости его telegramId.',
  rules: { telegramIdFree },
});
