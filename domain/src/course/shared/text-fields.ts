import * as v from 'valibot';

/**
 * Заголовок или описание: края обрезаются. Описание стоит до преобразования —
 * JSON Schema (`toJsonSchema`) обрывается на первом `transform`.
 */
export const trimmed = (label: string) =>
  v.pipe(
    v.string(),
    v.description(label),
    v.transform((value) => value.trim()),
    v.nonEmpty(`${label} не может быть пустым`),
  );

/** Необязательный текст карточки: приходит как есть. */
export const text = (label: string) =>
  v.pipe(v.optional(v.string()), v.description(label));
