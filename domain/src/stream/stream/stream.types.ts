/**
 * Факт о студенте потока для домена потока: чужой агрегат (студент)
 * отвечает за исход, поток спрашивает только итог. Строит UC
 * `complete-stream.uc.ts` прикладного слоя через `StreamMembersDqs`.
 */
export type StreamStudentFact = {
  readonly studentId: string;
  readonly userId: string;
  /** Сырой статус студента в потоке. */
  readonly status:
    | 'enrolled'
    | 'active'
    | 'abandoned'
    | 'advanced'
    | 'not_advanced';
  /** У студента есть итоговый исход — поток не ждёт его. */
  readonly settled: boolean;
  /** Студент учится или только зачислен. */
  readonly inProgress: boolean;
  /** Студент ещё не приступал к шагам. */
  readonly neverStarted: boolean;
};

/**
 * Место шага в снимке контента потока: куда идёт студент после шага и на
 * каком уровне заканчивается переход (урок, проект).
 */
export type StepPlace = {
  /** Следующий шаг по порядку обхода; нет — шаг последний в потоке. */
  readonly nextStepId?: string;
  readonly lessonId: string;
  readonly projectId: string;
  readonly lastInLesson: boolean;
  readonly lastLessonInProject: boolean;
};
