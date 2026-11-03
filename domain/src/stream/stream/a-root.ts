import { Aggregate } from '@u7-scl/core/domain';
import type { Course } from '@u7-scl/domain/course';
import { StudentAr } from '../student/a-root';
import type { Student } from '../student/entity';
import type { Stream, StreamArMeta } from './entity';
import { StreamSchema } from './entity';
import { LegacyStreamPolicy } from './policy';

/**
 * Legacy-агрегат потока для студента (зачисление, шаги контента) — до Ф2.
 * Жизненный цикл потока перенесён в `StreamAr` (stream.ar.ts).
 */
export class LegacyStreamAr extends Aggregate<StreamArMeta> {
  static readonly arName = 'Stream';
  static readonly arLabel = 'Поток';

  constructor(state: Stream) {
    super(state, StreamSchema);
  }

  /**
   * Зачисление студента на поток.
   *
   * Проверяет все бизнес-правила:
   * - enrollmentKey (если задан)
   * - отсутствие активной записи в другом потоке
   * - gate: canEnrollNextModule (доступ к следующему модулю курса)
   *
   * @returns { firstStepId } — ID первого шага потока для создания StudentAr
   * @throws BadRequestError при нарушении любого правила
   */
  enroll(params: {
    enrollmentKey?: string;
    course?: Course;
    existingStudents: Student[];
    studentStreams: Stream[];
    prevModuleTitle?: string;
  }): { firstStepId: string } {
    // 1. Проверка кодового слова
    if (this._state.enrollmentKey) {
      if (this._state.enrollmentKey !== params.enrollmentKey) {
        this.throwBadRequest('Неверное кодовое слово');
      }
    }

    // 2. Проверка на конфликт активных записей: живая запись
    //    (учится/зачислен) — признак агрегата StudentAr (ФР-10)
    const hasActive = params.existingStudents.some((s) =>
      new StudentAr(s).isInProgress(),
    );
    if (hasActive) {
      this.throwBadRequest('Вы уже проходите обучение в другом потоке');
    }

    // 3. Gate: проверка доступа к модулю курса (только если курс известен)
    if (
      params.course &&
      !LegacyStreamPolicy.canEnrollNextModule(
        params.course,
        this._state.moduleId,
        params.existingStudents,
        params.studentStreams,
      )
    ) {
      this.throwBadRequest(
        `Сначала пройдите модуль «${params.prevModuleTitle ?? 'предыдущий'}»`,
      );
    }

    // 4. Получение первого шага
    const firstStepId = this.getFirstStepId();
    if (!firstStepId) {
      this.throwBadRequest('В потоке нет доступных шагов');
    }

    return { firstStepId };
  }

  /**
   * Возвращает ID первого шага в потоке.
   */
  getFirstStepId(): string | null {
    for (const project of this._state.contentSnapshot) {
      for (const lesson of project.lessons) {
        if (lesson.stepIds.length > 0) {
          return lesson.stepIds[0] ?? null;
        }
      }
    }
    return null;
  }

  /**
   * Нахождение следующего шага в снимке контента потока.
   * Обходит дерево контента в глубину и возвращает UUID следующего шага.
   */
  findNextStep(currentStepId: string): string | null {
    const allStepIds: string[] = [];

    for (const project of this._state.contentSnapshot) {
      for (const lesson of project.lessons) {
        for (const stepId of lesson.stepIds) {
          allStepIds.push(stepId);
        }
      }
    }

    const index = allStepIds.indexOf(currentStepId);
    if (index === -1) {
      this.throwBadRequest('Шаг не найден в структуре потока');
    }

    if (index === allStepIds.length - 1) {
      return null;
    }

    return allStepIds[index + 1] ?? null;
  }

  /**
   * Контекст шага в дереве контента.
   * Определяет, является ли шаг последним в уроке, и является ли урок последним в проекте.
   */
  findStepContext(stepId: string): {
    lessonId: string;
    projectId: string;
    isLastStepInLesson: boolean;
    isLastLessonInProject: boolean;
  } {
    for (const project of this._state.contentSnapshot) {
      for (let li = 0; li < project.lessons.length; li++) {
        const lesson = project.lessons[li];
        if (!lesson) continue;
        for (let si = 0; si < lesson.stepIds.length; si++) {
          if (lesson.stepIds[si] === stepId) {
            return {
              lessonId: lesson.lessonId,
              projectId: project.projectId,
              isLastStepInLesson: si === lesson.stepIds.length - 1,
              isLastLessonInProject: li === project.lessons.length - 1,
            };
          }
        }
      }
    }
    this.throwBadRequest('Шаг не найден в структуре потока');
  }
}
