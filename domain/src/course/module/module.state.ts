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

/** Необязательный текст модуля или проекта: приходит как есть. */
const text = (label: string) =>
  v.pipe(v.optional(v.string()), v.description(label));

/**
 * Вложенная сущность модуля: своя идентичность `uuid` — на неё ссылаются
 * снимок потока и бот; собственных дат нет (DOM-13).
 */
export const ProjectEntity = v.object({
  uuid: F.uuid('проекта'),
  title: trimmed('Заголовок проекта'),
  goal: text('Цель проекта'),
  result: text('Результат проекта'),
  additional: text('Дополнительные материалы проекта'),
  status: F.picklist(
    ['draft', 'published', 'archived'],
    'Статус проекта: черновик, опубликован, в архиве',
  ),
  lessonIds: v.pipe(
    v.array(F.uuid('урока')),
    v.description('Уроки проекта по порядку прохождения'),
  ),
});

export type ProjectEntity = v.InferOutput<typeof ProjectEntity>;

/**
 * Entity модуля — единственное место структуры состояния. Legacy-записи
 * читаются: ISO-даты → число (UTC), нет `updatedAt` → `createdAt`, нет
 * `version` → 0 (D-36).
 */
export const ModuleState = v.object({
  ...BaseEntityFields,
  title: trimmed('Заголовок модуля'),
  description: trimmed('Описание модуля'),
  authorId: F.uuid('автора'),
  targetAudience: text('Целевая аудитория'),
  goal: text('Цель обучения'),
  result: text('Результат обучения'),
  rules: text('Правила прохождения'),
  additional: text('Дополнительные материалы'),
  tags: v.pipe(
    v.optional(v.array(v.string())),
    v.description('Теги: Веб, js, JavaScript'),
  ),
  status: F.picklist(
    ['draft', 'published', 'archived'],
    'Статус модуля: черновик, опубликован, в архиве',
  ),
  projects: v.pipe(
    v.array(ProjectEntity),
    v.description('Проекты модуля по порядку прохождения'),
  ),
});

export type ModuleState = v.InferOutput<typeof ModuleState>;
