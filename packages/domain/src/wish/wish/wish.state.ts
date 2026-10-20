import { F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Цель желания — универсальная ссылка на объект желания.
 * Дискриминированный союз по `kind`:
 * - `course` — желание пройти курс (вся программа, начиная со стартового модуля);
 * - `module` — желание пройти конкретный модуль (следующий/тот же).
 */
export const WishTarget = v.pipe(
  v.variant('kind', [
    v.object({
      kind: v.pipe(v.literal('course'), v.description('Цель — курс')),
      courseId: F.uuid('курса'),
    }),
    v.object({
      kind: v.pipe(v.literal('module'), v.description('Цель — модуль')),
      moduleId: F.uuid('модуля'),
    }),
  ]),
  v.description('Цель желания'),
);

export type WishTarget = v.InferOutput<typeof WishTarget>;

/**
 * Статус желания.
 * - `expressed` — мгновенная фиксация (курс без пула анкеты);
 * - `pending` — анкета начата, желание зафиксировано в ожидании;
 * - `confirmed` — анкета завершена, желание подтверждено;
 * - `cancelled` — отменено пользователем (из expressed/confirmed);
 * - `abandoned` — анкета брошена (из pending);
 * - `fulfilled` — реализовано (трек C2).
 */
export const WishStatus = F.picklist(
  ['expressed', 'pending', 'confirmed', 'cancelled', 'abandoned', 'fulfilled'],
  'Статус желания',
);

export type WishStatus = v.InferOutput<typeof WishStatus>;

/** Entity желания — единственное место структуры состояния. */
export const WishState = v.object({
  // biome-ignore lint/plugin: базовые поля без BaseEntityFields до Ф2 — DEBT-24
  uuid: v.pipe(v.string(), v.uuid('Некорректный формат UUID')),
  userId: F.uuid('пользователя'),
  target: WishTarget,
  status: WishStatus,
  // biome-ignore lint/plugin: базовые поля без BaseEntityFields до Ф2 — DEBT-24
  createdAt: v.pipe(
    v.string(),
    // biome-ignore lint/plugin: перенос без изменения схем, ISO-даты — DEBT-24
    v.isoDateTime('Некорректный формат даты создания'),
  ),
  // biome-ignore lint/plugin: базовые поля без BaseEntityFields до Ф2 — DEBT-24
  updatedAt: v.optional(
    // biome-ignore lint/plugin: перенос без изменения схем, ISO-даты — DEBT-24
    v.pipe(v.string(), v.isoDateTime('Некорректный формат даты обновления')),
  ),
});

export type WishState = v.InferOutput<typeof WishState>;
