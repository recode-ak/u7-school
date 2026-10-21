import * as v from 'valibot';
import { defineUseCase } from '#core/domain/contracts/define-use-case';
import { TaskArDef } from '../task.ar';
import { TaskErrors } from '../task.errors';
import { TaskPolicy } from '../task.policy';
import { TaskState } from '../task.state';

/**
 * Задача целиком — для фасада todo (D-42): выход — state агрегата, фасад
 * отдаёт его другим модулям как `ReadonlyAr<TaskAr>`.
 */
export const GetTaskUcDef = defineUseCase({
  name: 'getTask',
  label: 'Задача',
  description:
    'Задача по идентификатору — для других модулей; видна только владельцу.',
  type: 'query',
  aggregate: TaskArDef,
  callers: ['module'],
  policy: TaskPolicy.rules.canManage,
  input: v.object({ taskId: TaskState.entries.uuid }),
  output: TaskState,
  errors: [TaskErrors.NOT_FOUND],
});
