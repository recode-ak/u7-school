import * as v from 'valibot';

/** Элемент снимка контента модуля */
export interface ContentSnapshotItem {
  projectId: string;
  projectTitle: string;
  lessons: {
    lessonId: string;
    lessonTitle: string;
    stepIds: string[];
  }[];
}

/** Снимок контента модуля — дерево проектов с уроками и шагами */
export type ContentSnapshot = ContentSnapshotItem[];

/** Позиция шага в ContentSnapshot: индексы 1-based */
export interface StepPosition {
  projectIndex: number;
  projectTitle: string;
  lessonIndex: number;
  lessonTitle: string;
  stepIndex: number;
  totalSteps: number;
}

/**
 * Схемы снимка попадают в JSON Schema выхода UC и state потока, поэтому без
 * `v.trim()` (преобразование не выражается в JSON Schema).
 */

/** Схема урока внутри снимка контента */
export const LessonSnapshotSchema = v.object({
  lessonId: v.pipe(
    v.string(),
    v.uuid('Некорректный формат UUID урока'),
    v.description('Идентификатор урока'),
  ),
  lessonTitle: v.pipe(
    v.string(),
    v.nonEmpty('Заголовок урока не может быть пустым'),
    v.description('Заголовок урока'),
  ),
  stepIds: v.pipe(
    v.array(v.pipe(v.string(), v.uuid('Некорректный формат UUID шага'))),
    v.description('Шаги урока по порядку'),
  ),
});

/** Схема элемента снимка контента */
export const ContentSnapshotItemSchema = v.object({
  projectId: v.pipe(
    v.string(),
    v.uuid('Некорректный формат UUID проекта'),
    v.description('Идентификатор проекта'),
  ),
  projectTitle: v.pipe(
    v.string(),
    v.nonEmpty('Заголовок проекта не может быть пустым'),
    v.description('Заголовок проекта'),
  ),
  lessons: v.pipe(
    v.array(LessonSnapshotSchema),
    v.description('Уроки проекта по порядку'),
  ),
});

/** Схема снимка контента — массив проектов */
export const ContentSnapshotVo = v.pipe(
  v.array(ContentSnapshotItemSchema),
  v.description('Снимок контента модуля: проекты с уроками и шагами'),
);

/** Прежнее имя схемы снимка — для legacy-кода. */
export const ContentSnapshotSchema = ContentSnapshotVo;
