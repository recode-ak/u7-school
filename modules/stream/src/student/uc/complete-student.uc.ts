import {
  CompleteStudentUcDef,
  type StreamAr,
  StreamErrors,
  type StreamModuleDef,
  type StudentAr,
  StudentErrors,
} from '@u7-scl/domain/stream';
import { err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = { readonly student: StudentAr; readonly stream: StreamAr };
type Input = ParsedInputOf<typeof CompleteStudentUcDef>;

export class CompleteStudentUc extends UseCaseFromDef<
  typeof CompleteStudentUcDef,
  StreamDeps,
  Loaded,
  StreamUser
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(CompleteStudentUcDef, deps, module);
  }

  protected async load({ studentId, streamId }: Input) {
    const stream = await this.resolve.streams.findById(streamId);
    if (!stream) return err(StreamErrors.NOT_FOUND.make({ streamId }));
    const student = await this.resolve.students.findById(studentId);
    if (!student?.belongsToStream(streamId)) {
      return StudentErrors.NOT_FOUND.err();
    }
    return ok({ student, stream });
  }

  protected async execute(
    { outcome }: Input,
    { student, stream }: Loaded,
    uow: UnitOfWork,
  ) {
    const completed = student.complete(
      outcome,
      stream.view().moduleId,
      this.now(),
    );
    if (!completed.ok) return completed;
    uow.register(student, this.resolve.students);
    return ok({});
  }
}
