import type { ArMeta } from '@u7-scl/core/domain';
import { ContentSnapshotSchema } from '@u7-scl/domain/course';
import * as v from 'valibot';
import { StreamStatusSchema } from '../status';

/** Схема сущности потока курсов */
export const StreamSchema = v.object({
  uuid: v.pipe(v.string(), v.uuid('Некорректный формат UUID потока')),
  schoolId: v.pipe(v.string(), v.uuid('Некорректный формат UUID школы')),
  title: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Заголовок потока не может быть пустым'),
  ),
  description: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Описание потока не может быть пустым'),
  ),
  mentorId: v.pipe(v.string(), v.uuid('Некорректный формат UUID ментора')),
  moduleId: v.pipe(v.string(), v.uuid('Некорректный формат UUID модуля')),
  startDate: v.pipe(
    v.string(),
    // biome-ignore lint/plugin: перенос без изменения схем (ISO-даты — DEBT-5)
    v.isoDateTime('Некорректный формат даты начала'),
  ),
  status: StreamStatusSchema,
  telegramGroupId: v.optional(v.string()),
  telegramGroupInvite: v.optional(v.string()),

  goal: v.optional(v.string()),
  result: v.optional(v.string()),
  rules: v.optional(v.string()),
  additional: v.optional(v.string()),
  targetAudience: v.optional(v.string()),

  enrollmentKey: v.optional(v.string()),

  contentSnapshot: ContentSnapshotSchema,

  createdAt: v.pipe(
    v.string(),
    // biome-ignore lint/plugin: перенос без изменения схем (ISO-даты — DEBT-5)
    v.isoDateTime('Некорректный формат даты создания'),
  ),
  updatedAt: v.optional(
    // biome-ignore lint/plugin: перенос без изменения схем (ISO-даты — DEBT-5)
    v.pipe(v.string(), v.isoDateTime('Некорректный формат даты обновления')),
  ),
});

export type Stream = v.InferOutput<typeof StreamSchema>;

export interface StreamArMeta extends ArMeta {
  name: 'Stream';
  label: 'Поток';
  state: Stream;
}
