import type { ReadonlyAr } from '#core/domain/aggregate/readonly-ar';
import type { UseCaseErrorOf } from '#core/domain/contracts/define-use-case';
import type { CallContext } from '#core/kernel/caller/call-context';
import type { Result } from '#core/kernel/result/result';
import type { TaskAr } from './task/task.ar';
import type { GetTaskUcDef } from './task/uc/get-task.uc';

/**
 * Фасад модуля todo — рантайм-граница для других модулей (D-42): обычный
 * TS-тип, не Def. Каждый метод — обёртка над UC модуля: первый аргумент —
 * контекст вызова операции-потребителя, ошибки — ошибки UC.
 */
export type TodoFacade = {
  /** Задача владельца — только для чтения (UC `getTask`). */
  getTask(
    call: CallContext,
    taskId: string,
  ): Promise<Result<ReadonlyAr<TaskAr>, UseCaseErrorOf<typeof GetTaskUcDef>>>;
};
