import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ContentSnapshotVo } from '../../content-snapshot';
import { CourseArDef } from '../course.ar';
import { CourseErrors } from '../course.errors';

/**
 * Снимок контента модуля — для других модулей (поток фиксирует его при
 * создании). Модуля нет — `COURSE_MODULE_NOT_FOUND`.
 *
 * `allowAll`: вызывает система (UC другого модуля), содержимое модуля не
 * зависит от субъекта.
 */
export const GetModuleSnapshotUcDef = UseCaseDef.define({
  name: 'getModuleSnapshot',
  label: 'Снимок контента модуля',
  description:
    'Дерево проектов, уроков и шагов модуля на текущий момент — для других модулей.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({ moduleId: F.uuid('модуля') }),
  output: ContentSnapshotVo,
  errors: [CourseErrors.MODULE_NOT_FOUND],
});
