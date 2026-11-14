import * as v from 'valibot';

/**
 * Версия в представлении обязательна: клиент сверяет её при записи, а в state
 * поле необязательно — legacy-запись читается как версия 0 (D-36).
 * Своя схема, а не `BaseEntityFields.version`: `nonOptional` в JSON Schema
 * выхода не выражается (MAN-03).
 */
export const VersionOut = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.description('Версия сущности (оптимистичная блокировка)'),
);
