import {
  type StreamStudentFact,
  StudentAr,
  type StudentRepo,
} from '@u7-scl/domain/stream';
import type { StreamStudents } from '../stream/stream-students';

/**
 * Мост к legacy-студентам: порт `StreamStudents` над `StudentRepo`.
 * Уйдёт, когда студент переедет на Def (Ф2 трека stream-dmg).
 */
export function legacyStreamStudents(students: StudentRepo): StreamStudents {
  return {
    async factsOf(streamId) {
      const list = await students.getByStream(streamId);
      return list.map((entity): StreamStudentFact => {
        const ar = new StudentAr(entity);
        return {
          studentId: entity.uuid,
          userId: entity.userId,
          status: entity.status,
          settled: ar.isTerminal(),
          inProgress: ar.isInProgress(),
          neverStarted: ar.neverStarted(),
        };
      });
    },

    async launch(streamId, firstStepId) {
      for (const entity of await students.getByStream(streamId)) {
        const ar = new StudentAr(entity);
        let changed = false;

        if (ar.isEnrolled()) {
          ar.activate();
          changed = true;
        }
        if (entity.steps.length === 0) {
          ar.issueStep(firstStepId);
          changed = true;
        }
        if (changed) await students.save(ar.state);
      }
    },
  };
}
