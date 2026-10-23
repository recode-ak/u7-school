/**
 * Цели желаний при зачислении: о каких курсах и модулях спросить модуль
 * курсов (`WishAr.fulfillmentTargets`) или какие из них зачисление
 * реализует (`WishAr.isFulfilledBy`). Вид цели задаёт список, не поле.
 */
export type FulfillmentTargets = {
  readonly courseIds: readonly string[];
  readonly moduleIds: readonly string[];
};
