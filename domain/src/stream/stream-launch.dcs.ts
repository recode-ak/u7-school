import {
  type ErrorOf,
  ok,
  type RejectOf,
  type Result,
  type Timestamp,
} from 'dmg-core';
import type { StreamAr, StreamArDef } from './stream/stream.ar';
import type { StudentAr, StudentArDef } from './student/student.ar';
import type { StudentErrors } from './student/student.errors';

/** Отказ запуска: поток не в наборе; остальное — сбой выдачи первого шага студентам. */
export type StreamLaunchError =
  | RejectOf<typeof StreamArDef, 'activate'>
  | RejectOf<typeof StudentArDef, 'activate'>
  | ErrorOf<typeof StudentErrors.STEP_ALREADY_ISSUED>;

/**
 * Запуск потока: переводит поток в активный и поднимает его студентов.
 *
 * Сначала `stream.activate` — отказ потока оставляет студентов нетронутыми.
 * Затем каждому зачисленному — `activate`, каждому без шагов (статус не
 * важен, как в legacy) — первый шаг потока. Что нужно студенту, отвечает
 * сам `StudentAr`; сервис собирает порядок и применяет.
 */
export const StreamLaunchDcs = {
  /**
   * Запускает поток и возвращает изменённых студентов — их регистрирует
   * вызывающий. Первого шага в потоке нет — поток активен, студенты не меняются.
   */
  launch(
    stream: StreamAr,
    students: readonly StudentAr[],
    at: Timestamp,
  ): Result<readonly StudentAr[], StreamLaunchError> {
    const activated = stream.activate(at);
    if (!activated.ok) return activated;
    const firstStepId = stream.firstStepId();
    if (firstStepId === undefined) return ok([]);
    const changed: StudentAr[] = [];
    for (const student of students) {
      let touched = false;
      if (student.isEnrolled()) {
        const res = student.activate(at);
        if (!res.ok) return res;
        touched = true;
      }
      if (student.hasNoSteps()) {
        const res = student.issueStep(firstStepId, at);
        if (!res.ok) return res;
        touched = true;
      }
      if (touched) changed.push(student);
    }
    return ok(changed);
  },
};
