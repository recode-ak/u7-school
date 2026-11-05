import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';
import { ProjectVo } from '../shared/project-vo';
import { text, trimmed } from '../shared/text-fields';

// VO проекта — в `shared/`: DOM-11 запрещает ключ `uuid` в `*.state.ts`.
export { ProjectVo } from '../shared/project-vo';

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
    v.array(ProjectVo),
    v.description('Проекты модуля по порядку прохождения'),
  ),
});

export type ModuleState = v.InferOutput<typeof ModuleState>;
