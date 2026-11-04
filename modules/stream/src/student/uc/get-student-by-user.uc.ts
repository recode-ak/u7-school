import {
  GetStudentByUserUcDef,
  type StreamModuleDef,
  StudentErrors,
} from '@u7-scl/domain/stream';
import { type Identified, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps } from '../../stream.module';

type Input = ParsedInputOf<typeof GetStudentByUserUcDef>;

/** Живая запись пользователя, иначе первая с исходом. */
export class GetStudentByUserUc extends UseCaseFromDef<
  typeof GetStudentByUserUcDef,
  StreamDeps,
  undefined,
  Identified
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(GetStudentByUserUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ userId }: Input, _: undefined, __: UnitOfWork) {
    const students = await this.resolve.students.findByUser(userId);
    const found =
      students.find((s) => s.isInProgress()) ??
      students.find((s) => s.isTerminal());
    if (!found) return StudentErrors.NOT_FOUND.err();
    return ok(found.view());
  }
}
