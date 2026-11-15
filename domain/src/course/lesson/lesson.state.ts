import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Заголовок или описание: края обрезаются. Описание стоит до преобразования —
 * JSON Schema (`toJsonSchema`) обрывается на первом `transform`.
 */
const trimmed = (label: string) =>
  v.pipe(
    v.string(),
    v.description(label),
    v.transform((value) => value.trim()),
    v.nonEmpty(`${label} не может быть пустым`),
  );

/** Необязательный текст урока: приходит как есть. */
const text = (label: string) =>
  v.pipe(v.optional(v.string()), v.description(label));

/**
 * Entity урока — единственное место структуры состояния. Legacy-записи
 * читаются: нет `updatedAt` → `createdAt`, нет
 * `version` → 0 (D-36).
 */
export const LessonState = v.object({
  ...BaseEntityFields,
  moduleId: F.uuid('модуля'),
  title: trimmed('Заголовок урока'),
  additional: text('Дополнительные материалы урока'),
  status: F.picklist(
    ['draft', 'published', 'archived'],
    'Статус урока: черновик, опубликован, в архиве',
  ),
  estimatedMinutes: v.pipe(
    v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
    v.description('Оценка длительности урока в минутах'),
  ),
  stepIds: v.pipe(
    v.array(F.uuid('шага')),
    v.description('Шаги урока по порядку прохождения'),
  ),
  mentorStepIds: v.pipe(
    v.array(F.uuid('шага')),
    v.description('Шаги урока для ментора по порядку прохождения'),
  ),
});

export type LessonState = v.InferOutput<typeof LessonState>;
