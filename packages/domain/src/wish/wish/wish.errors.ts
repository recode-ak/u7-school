import { defineErrors } from 'dmg-core';

/**
 * Ошибки агрегата `wish` — пока только отказы переходов (TR-1).
 * Ошибки UC (`WISH_ALREADY_EXISTS`, `WISH_NOT_FOUND`, …) живут в legacy
 * `errors.ts` до Ф4. `label` — прежний текст legacy-исключения: UC/ER
 * поднимают его, пока `Result` не дошёл до вызывающих.
 */
export const WishErrors = defineErrors('WISH', {
  NOT_CONFIRMABLE: {
    kind: 'conflict',
    label: 'Подтвердить можно только ожидающее анкету желание',
    description: 'Подтверждение доступно только из pending (анкетная ветка).',
  },
  NOT_ABANDONABLE: {
    kind: 'conflict',
    label: 'Бросить можно только ожидающее анкету желание',
    description: 'Прервать анкету можно только у желания в pending.',
  },
  NOT_CANCELLABLE: {
    kind: 'conflict',
    label: 'Отменить можно только выраженное или подтверждённое желание',
    description:
      'Отмена доступна из expressed и confirmed; для pending — только abandon.',
  },
  NOT_FULFILLABLE: {
    kind: 'conflict',
    label: 'Реализовать можно только выраженное или подтверждённое желание',
    description:
      'Реализация доступна из expressed и confirmed; pending сначала подтверждается анкетой.',
  },
});
