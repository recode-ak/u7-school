import {
  GetModuleSnapshotUcDef,
  ModuleErrors,
} from '@u7-scl/domain/course/contract';
import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef } from '../stream.ar';
import { StreamErrors } from '../stream.errors';
import { StreamEvents } from '../stream.events';
import { StreamPolicy } from '../stream.policy';

/**
 * Обновление контента идущего потока (F-80). Студенты записываются раньше
 * потока (ФР-8а): повтор с тем же списком доводит сбойное обновление до конца.
 */
export const SyncStreamContentUcDef = UseCaseDef.define({
  name: 'syncStreamContent',
  label: 'Обновить контент потока',
  description:
    'Применяет актуальный снимок модуля к потоку и пересчитывает прогресс подтверждённых студентов.',
  type: 'command',
  aggregate: StreamArDef,
  callers: ['user'],
  policy: StreamPolicy.rules.canManage,
  calls: [GetModuleSnapshotUcDef],
  input: v.object({
    streamId: F.uuid('потока'),
    confirmedStudentIds: v.pipe(
      v.array(F.uuid('подтверждённого студента')),
      v.description('Студенты, чьё изменение прогресса подтверждено'),
    ),
    expectedVersion: F.expectedVersion('потока'),
  }),
  output: v.object({
    mode: v.pipe(
      v.picklist(['replace', 'sync']),
      v.description('replace — без студентов (набор), sync — с пересчётом'),
    ),
    credited: v.pipe(
      v.array(
        v.object({
          studentId: F.uuid('студента'),
          stepIds: v.pipe(
            v.array(F.uuid('зачтённого шага')),
            v.description('Шаги, зачтённые студенту'),
          ),
        }),
      ),
      v.description('Зачтённые шаги по студентам'),
    ),
  }),
  errors: [
    StreamErrors.NOT_FOUND,
    ModuleErrors.NOT_FOUND,
    StreamErrors.CONTENT_NOT_SYNCABLE,
    StreamErrors.SYNC_REMOVES_CURRENT_STEP,
    StreamErrors.SYNC_NEEDS_CONFIRMATION,
  ],
  emits: [StreamEvents.contentSynced],
});
