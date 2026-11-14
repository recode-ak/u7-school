import {
  GetSnapshotStepsUcDef,
  StepErrors,
  StepView,
} from '@u7-scl/domain/course/contract';
import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef } from '../stream.ar';
import { StreamErrors } from '../stream.errors';
import { StreamPolicy } from '../stream.policy';

/**
 * Шаг из потока по снимку: виден участнику, даже если в курсе снят с
 * публикации. Право — `canReadStep` (контекст — поток, запись
 * вызывающего в нём и шаг: студенту — только выданный или пройденный); шаг вне снимка (`StreamAr.hasStep`) — `STEP_NOT_FOUND`;
 * содержимое — `getSnapshotSteps` курса, только после права и проверки снимка.
 */
export const GetStreamStepUcDef = UseCaseDef.define({
  name: 'getStreamStep',
  label: 'Шаг потока',
  description:
    'Шаг из программы потока для его студента, ментора или администратора — независимо от статуса шага в курсе.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['user'],
  policy: StreamPolicy.rules.canReadStep,
  calls: [GetSnapshotStepsUcDef],
  input: v.object({
    streamId: F.uuid('потока'),
    stepId: F.uuid('шага'),
  }),
  output: StepView,
  errors: [StreamErrors.NOT_FOUND, StepErrors.NOT_FOUND],
});
