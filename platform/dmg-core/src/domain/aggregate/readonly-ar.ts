import type { Result } from '#core/kernel/result/result';

type MutatingKeys<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => Result<unknown, unknown>
    ? K
    : never;
}[keyof T];

/**
 * Агрегат только для чтения — так его видят другие модули (через фасад).
 * Остаются идентификаторы, версия и методы-вопросы; убраны мутирующие
 * методы (возвращают `Result`, DOM-02), снимок entity (DOM-01), выдача
 * событий и служебные методы записи.
 */
export type ReadonlyAr<T> = Omit<
  T,
  MutatingKeys<T> | 'snapshot' | 'pullEvents' | 'storedVersion' | 'markStored'
>;
