import { describe, expect, test } from 'bun:test';
import type { ReadonlyAr } from '#core/domain/aggregate/readonly-ar';
import { ok, type Result } from '#core/kernel/result/result';
import { TaskAr, TaskErrors } from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/task/task.state';
import { TASK, TASK_2, taskRow } from '../app.fixture';
import { asReadonlyAr } from './as-readonly-ar';

const notFound = TaskErrors.NOT_FOUND.err({ taskId: TASK });

describe('asReadonlyAr', () => {
  test('state агрегата → ReadonlyAr через restore', () => {
    const res: Result<TaskState, typeof notFound.error> = ok(taskRow(TASK));
    const task = asReadonlyAr(TaskAr, res);
    if (!task.ok) throw new Error('ожидался Ok');
    const value: ReadonlyAr<TaskAr> = task.value;
    expect(value).toBeInstanceOf(TaskAr);
    expect(value.uuid).toBe(TASK);
    // @ts-expect-error мутирующий метод скрыт (ReadonlyAr)
    expect(typeof value.complete).toBe('function');
  });

  test('массив state → массив ReadonlyAr', () => {
    const res: Result<TaskState[], never> = ok([
      taskRow(TASK),
      taskRow(TASK_2, 'done'),
    ]);
    const tasks = asReadonlyAr(TaskAr, res);
    if (!tasks.ok) throw new Error('ожидался Ok');
    const value: ReadonlyAr<TaskAr>[] = tasks.value;
    expect(value.map((t) => t.uuid)).toEqual([TASK, TASK_2]);
    expect(value.every((t) => t instanceof TaskAr)).toBe(true);
  });

  test('ошибка UC — как есть', () => {
    const res: Result<TaskState, typeof notFound.error> = notFound;
    expect(asReadonlyAr(TaskAr, res)).toBe(notFound);
  });

  test('state другого агрегата — ошибка компиляции', () => {
    const res: Result<{ uuid: string }, never> = ok({ uuid: TASK });
    // @ts-expect-error restore TaskAr ждёт TaskState
    const wrong = () => asReadonlyAr(TaskAr, res);
    expect(wrong).toBeDefined();
  });
});
