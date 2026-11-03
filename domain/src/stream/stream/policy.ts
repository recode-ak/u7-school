import { type Course, CoursePolicy } from '@u7-scl/domain/course';
import { type User, UserPolicy } from '@u7-scl/domain/user';
import { StudentAr } from '../student/a-root';
import type { Student } from '../student/entity';
import type { Stream } from './entity';

/** Legacy-права потока для студента (зачисление) — до Ф2; права потока — `StreamPolicy` (stream.policy.ts). */
export const LegacyStreamPolicy = {
  canEnroll(actor: User): boolean {
    return !UserPolicy.isStudent(actor);
  },

  isMentor(actor: User, stream: Stream): boolean {
    return actor.uuid === stream.mentorId;
  },

  /**
   * Может ли студент записаться на указанный модуль курса.
   *
   * @param course — курс с фазами и упорядоченными moduleIds
   * @param targetModuleId — модуль, на который планируется запись
   * @param students — все записи студента (Student)
   * @param streams — соответствующие потоки (Stream), чтобы взять moduleId
   */
  canEnrollNextModule(
    course: Course,
    targetModuleId: string,
    students: Student[],
    streams: Stream[],
  ): boolean {
    const streamMap = new Map(streams.map((s) => [s.uuid, s.moduleId]));

    // «Прошёл» — признак агрегата StudentAr (ФР-10): not_advanced
    // не даёт права записи на следующий модуль
    const completedModuleIds = students
      .filter((s) => new StudentAr(s).isPassed())
      .map((s) => streamMap.get(s.streamId))
      .filter((id): id is string => id !== undefined);

    return CoursePolicy.canEnrollNextModule(
      course,
      targetModuleId,
      completedModuleIds,
    );
  },
};
