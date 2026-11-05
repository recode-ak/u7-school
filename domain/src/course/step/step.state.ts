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

/** Необязательный текст шага: приходит как есть. */
const text = (label: string) =>
  v.pipe(v.optional(v.string()), v.description(label));

/**
 * Метаданные файла шага: VO своего модуля — домен не зависит от общей схемы
 * платформы. Идентичность — `uuid` файла в хранилище.
 */
export const FileVo = v.object({
  uuid: F.uuid('файла'),
  name: trimmed('Имя файла'),
  mimeType: trimmed('MIME-тип файла'),
  size: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.description('Размер файла в байтах'),
  ),
  description: text('Описание файла'),
});

export type FileVo = v.InferOutput<typeof FileVo>;

/** Поля, общие для всех видов шага. */
const common = {
  ...BaseEntityFields,
  moduleId: F.uuid('модуля'),
  description: trimmed('Описание шага'),
  content: text('Содержимое шага'),
  status: F.picklist(
    ['draft', 'published', 'archived'],
    'Статус шага: черновик, опубликован, в архиве',
  ),
};

/** Текстовый шаг: тело — в `content`. */
export const StepTextState = v.object({
  ...common,
  kind: v.pipe(v.literal('text'), v.description('Вид шага: текстовый')),
});

/** Шаг с кодом: код и язык подсветки. */
export const StepCodeState = v.object({
  ...common,
  kind: v.pipe(v.literal('code'), v.description('Вид шага: с кодом')),
  code: v.pipe(
    v.string(),
    v.nonEmpty('Код не может быть пустым'),
    v.description('Код шага'),
  ),
  language: text('Язык кода'),
});

/** Шаг с файлом: только метаданные, содержимое — в хранилище файлов. */
export const StepFileState = v.object({
  ...common,
  kind: v.pipe(v.literal('file'), v.description('Вид шага: с файлом')),
  file: v.pipe(FileVo, v.description('Файл шага')),
});

/**
 * Entity шага — единственное место структуры состояния: вид выбирает ветку
 * `variant`. Legacy-записи читаются: ISO-даты → число (UTC), нет `updatedAt` →
 * `createdAt`, нет `version` → 0 (D-36).
 */
export const StepState = v.variant('kind', [
  StepTextState,
  StepCodeState,
  StepFileState,
]);

export type StepState = v.InferOutput<typeof StepState>;
