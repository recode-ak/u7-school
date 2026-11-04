import {
  CompleteStepUcDef,
  StepCompletionDcs,
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
type Input = ParsedInputOf<typeof CompleteStepUcDef>;

export class CompleteStepUc extends UseCaseFromDef<
  typeof CompleteStepUcDef,
  StreamDeps,
  Loaded,
  StreamUser
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(CompleteStepUcDef, deps, module);
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
    { stepId }: Input,
    { student, stream }: Loaded,
    uow: UnitOfWork,
  ) {
    const result = StepCompletionDcs.completeStep(
      stream,
      student,
      stepId,
      this.now(),
    );
    if (!result.ok) return result;
    if (result.value.level !== 'already_completed') {
      uow.register(student, this.resolve.students);
    }
    return result;
  }
}
