import { ContentSnapshotVo } from '@u7-scl/domain/course/contract';
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

/** Необязательный текст потока: поле приходит из карточки потока как есть. */
const text = (label: string) =>
  v.pipe(v.optional(v.string()), v.description(label));

/**
 * Entity потока — единственное место структуры состояния. Legacy-записи
 * читаются: ISO-даты → число (UTC), нет `updatedAt` → `createdAt`, нет
 * `version` → 0 (D-36).
 */
export const StreamState = v.object({
  ...BaseEntityFields,
  schoolId: F.uuid('школы'),
  mentorId: F.uuid('ментора потока'),
  moduleId: F.uuid('модуля потока'),
  title: trimmed('Заголовок потока'),
  description: trimmed('Описание потока'),
  startDate: F.timestamp('начала потока'),
  status: F.picklist(
    ['enrollment', 'active', 'completed', 'archived'],
    'Статус потока: набор, идёт, завершён, в архиве',
  ),
  telegramGroupId: text('Идентификатор Telegram-группы потока'),
  telegramGroupInvite: F.sensitive(
    text('Ссылка-приглашение в Telegram-группу потока'),
  ),
  goal: text('Цель обучения'),
  result: text('Результат обучения'),
  rules: text('Правила прохождения'),
  additional: text('Дополнительные материалы'),
  targetAudience: text('Целевая аудитория'),
  enrollmentKey: F.sensitive(text('Кодовое слово для зачисления')),
  contentSnapshot: v.pipe(
    ContentSnapshotVo,
    v.description('Снимок контента модуля на момент создания потока'),
  ),
});

export type StreamState = v.InferOutput<typeof StreamState>;
