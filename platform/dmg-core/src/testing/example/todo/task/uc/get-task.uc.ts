import * as v from 'valibot';
import { UseCaseDef } from '#core/domain/contracts/use-case-def';
import { TaskArDef } from '../task.ar';
import { TaskErrors } from '../task.errors';
import { TaskPolicy } from '../task.policy';
import { TaskState } from '../task.state';

/**
 * Задача целиком — для других модулей (D-42, D-43): вызывается только
 * системой (через фасад todo), выход — state агрегата; вызывающий сам
 * собирает из него `ReadonlyAr<TaskAr>` (`TaskAr.readonly`).
 */
export const GetTaskUcDef = UseCaseDef.define({
  name: 'getTask',
  label: 'Задача',
  description:
    'Задача по идентификатору — для других модулей; видна только владельцу.',
  type: 'query',
  aggregate: TaskArDef,
  callers: ['system'],
  policy: TaskPolicy.rules.canManage,
  input: v.object({ taskId: TaskState.entries.uuid }),
  output: TaskState,
  errors: [TaskErrors.NOT_FOUND],
});
