import {
  GetModuleSnapshotUcDef,
  ModuleErrors,
} from '@u7-scl/domain/course/contract';
import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ContentSyncPlanVo } from '../../content-sync.types';
import { StreamArDef } from '../stream.ar';
import { StreamErrors } from '../stream.errors';
import { StreamPolicy } from '../stream.policy';

/**
 * Предпросмотр обновления контента идущего потока (F-80): ничего не пишет.
 * `streamVersion` скрипт передаёт в `syncStreamContent.expectedVersion`.
 * Отказ по статусу и удалённый текущий шаг — в `plan.blockers`, не `Err`.
 */
export const PreviewStreamContentSyncUcDef = UseCaseDef.define({
  name: 'previewStreamContentSync',
  label: 'Предпросмотр обновления контента потока',
  description:
    'Сравнивает снимок потока с актуальным контентом модуля и строит план по студентам.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['user'],
  policy: StreamPolicy.rules.canManage,
  calls: [GetModuleSnapshotUcDef],
  input: v.object({ streamId: F.uuid('потока') }),
  output: v.object({
    plan: ContentSyncPlanVo,
    streamVersion: F.int('Версия потока, по которой построен план'),
  }),
  errors: [StreamErrors.NOT_FOUND, ModuleErrors.NOT_FOUND],
});
