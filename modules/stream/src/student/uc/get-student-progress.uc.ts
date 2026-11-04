import {
  GetStudentProgressUcDef,
  type StreamModuleDef,
  StudentErrors,
  StudentProgressDqs,
} from '@u7-scl/domain/stream';
import { type Identified, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps } from '../../stream.module';

type Input = ParsedInputOf<typeof GetStudentProgressUcDef>;

/**
 * Запись студента и расчёты по снимку контента потока (`StudentProgressDqs`).
 * Потока нет — `progress` не заполняется. Прогресс виден любому (`allowAll`).
 */
export class GetStudentProgressUc extends UseCaseFromDef<
  typeof GetStudentProgressUcDef,
  StreamDeps,
  undefined,
  Identified
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(GetStudentProgressUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(
    { studentId, stepId, lessonId }: Input,
    _: undefined,
    __: UnitOfWork,
  ) {
    const { students, streams } = this.resolve;
    const student = await students.findById(studentId);
    if (!student) return StudentErrors.NOT_FOUND.err();
    const stream = await streams.findById(student.view().streamId);
    if (!stream) return ok({ student: student.view() });

    const snapshot = stream.view().contentSnapshot;
    const dqs = StudentProgressDqs;
    return ok({
      student: student.view(),
      progress: {
        module: dqs.computeProgress(snapshot, student),
        projects: dqs.computeStreamProjectProgress(snapshot, student),
        card: dqs.computeStudentCard(snapshot, student),
        tree: dqs.buildNavigationTree(snapshot, student),
        step:
          stepId === undefined
            ? undefined
            : {
                position: dqs.stepPosition(snapshot, stepId) ?? undefined,
                lessonProgress: dqs.getStepLessonProgress(
                  snapshot,
                  stepId,
                  student,
                ),
              },
        lesson:
          lessonId === undefined
            ? undefined
            : (dqs.buildLessonSteps(snapshot, lessonId, student) ?? undefined),
      },
    });
  }
}
