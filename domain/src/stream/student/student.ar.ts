import { AggregateDef, BaseEntityFields, ErrorDef } from 'dmg-core';
import * as v from 'valibot';
import { StudentEvents } from './student.events';

/**
 * Def агрегата внешнего модуля (D-37): только контракт событий.
 * Состояние и ошибки — пустой минимум; агрегат реализует legacy-код.
 */
export const StudentArDef = AggregateDef.define({
  name: 'student',
  label: 'Студент',
  description:
    'Участие пользователя в потоке: зачисление и прохождение модуля.',
  state: v.object({ ...BaseEntityFields }),
  events: StudentEvents,
  errors: ErrorDef.define('STUDENT', {}),
});
