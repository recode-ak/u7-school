import {
  GetActiveStudentUcDef,
  type StreamModuleDef,
} from '@u7-scl/domain/stream';
import { type Identified, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps } from '../../stream.module';

type Input = ParsedInputOf<typeof GetActiveStudentUcDef>;

/** Первая живая запись пользователя и её поток; записи нет — пустой ответ. */
export class GetActiveStudentUc extends UseCaseFromDef<
  typeof GetActiveStudentUcDef,
  StreamDeps,
  undefined,
  Identified
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(GetActiveStudentUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ userId }: Input, _: undefined, __: UnitOfWork) {
    const students = await this.resolve.students.findByUser(userId);
    const student = students.find((s) => s.isInProgress());
    if (!student) return ok({});
    const stream = await this.resolve.streams.findById(student.view().streamId);
    return ok({ student: student.view(), stream: stream?.view() });
  }
}
