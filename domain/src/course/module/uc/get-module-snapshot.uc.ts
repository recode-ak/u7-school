import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ContentSnapshotVo } from '../../content-snapshot';
import { CourseErrors } from '../../course/course.errors';
import { ModuleArDef } from '../module.ar';

/**
 * Снимок контента модуля — для других модулей: поток фиксирует его при
 * создании. Модуля нет — `COURSE_MODULE_NOT_FOUND` (ошибка агрегата `course`
 * по ссылке до объединения с `MODULE_NOT_FOUND`).
 *
 * `allowAll`: чтение открыто всем, видимость модуля решает UC через
 * `ModulePolicy` (гость субъекта не имеет). `system` — вызов из `createStream`,
 * субъект — `person` ментора.
 */
export const GetModuleSnapshotUcDef = UseCaseDef.define({
  name: 'getModuleSnapshot',
  label: 'Снимок контента модуля',
  description:
    'Дерево опубликованных проектов, уроков и шагов модуля на текущий момент — для других модулей.',
  type: 'query',
  aggregate: ModuleArDef,
  callers: ['user', 'guest', 'system'],
  policy: allowAll,
  input: v.object({ moduleId: F.uuid('модуля') }),
  output: ContentSnapshotVo,
  errors: [CourseErrors.MODULE_NOT_FOUND],
});
