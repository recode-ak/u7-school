import {
  DropStudentUcDef,
  type StreamModuleDef,
  type StudentAr,
  StudentErrors,
} from '@u7-scl/domain/stream';
import { ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = { readonly student: StudentAr };
type Input = ParsedInputOf<typeof DropStudentUcDef>;

export class DropStudentUc extends UseCaseFromDef<
  typeof DropStudentUcDef,
  StreamDeps,
  Loaded,
  StreamUser
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(DropStudentUcDef, deps, module);
  }

  protected async load({ studentId, streamId }: Input) {
    const student = await this.resolve.students.findById(studentId);
    if (!student?.belongsToStream(streamId)) {
      return StudentErrors.NOT_FOUND.err();
    }
    return ok({ student });
  }

  protected async execute(_: Input, { student }: Loaded, uow: UnitOfWork) {
    const dropped = student.drop(this.now());
    if (!dropped.ok) return dropped;
    uow.register(student, this.resolve.students);
    return ok({});
  }
}
