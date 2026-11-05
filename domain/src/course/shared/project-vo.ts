import { F } from 'dmg-core';
import * as v from 'valibot';
import { text, trimmed } from './text-fields';

/**
 * Проект модуля — VO без собственных дат (DOM-13). Живёт в `shared/`, а не в
 * `module.state.ts`: DOM-11 запрещает ключ `uuid` в схеме state, а проект
 * ссылается на себя своим `uuid` из legacy-формата.
 */
export const ProjectVo = v.object({
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

export type ProjectVo = v.InferOutput<typeof ProjectVo>;
