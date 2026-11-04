import {
  GetStudentProgressUcDef,
  StreamMembersDqs,
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
 * Отставание в карточке — из `StreamMembersDqs.roster` по студентам потока.
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

    // Медиана отставания — по учащимся потока, поэтому нужен весь состав.
    const lag = new StreamMembersDqs(
      stream,
      await students.findByStream(stream.uuid),
    )
      .roster(this.now())
      .find((row) => row.studentId === student.uuid);

    const dqs = new StudentProgressDqs(stream.view().contentSnapshot, student);
    return ok({
      student: student.view(),
      progress: {
        module: dqs.computeProgress(),
        projects: dqs.computeStreamProjectProgress(),
        card: dqs.computeStudentCard(lag),
        tree: dqs.buildNavigationTree(),
        step:
          stepId === undefined
            ? undefined
            : {
                position: dqs.stepPosition(stepId) ?? undefined,
                lessonProgress: dqs.getStepLessonProgress(stepId),
              },
        lesson:
          lessonId === undefined
            ? undefined
            : (dqs.buildLessonSteps(lessonId) ?? undefined),
      },
    });
  }
}
