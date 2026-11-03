import {
  GetStreamMembersUcDef,
  type StreamModuleDef,
} from '@u7-scl/domain/stream';
import { type Identified, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps } from '../../stream.module';

type Input = ParsedInputOf<typeof GetStreamMembersUcDef>;

/**
 * Состав потока: ментор из потока, студенты — факты порта `StreamStudents`
 * без `settled` (это вопрос правила завершения). Потока нет — `undefined`.
 */
export class GetStreamMembersUc extends UseCaseFromDef<
  typeof GetStreamMembersUcDef,
  StreamDeps,
  undefined,
  Identified
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(GetStreamMembersUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ streamId }: Input, _: undefined, __: UnitOfWork) {
    const stream = await this.resolve.streams.findById(streamId);
    if (!stream) return ok(undefined);

    const facts = await this.resolve.students.factsOf(streamId);
    return ok({
      mentorId: stream.view().mentorId,
      students: facts.map(
        ({ studentId, userId, status, neverStarted, inProgress }) => ({
          studentId,
          userId,
          status,
          neverStarted,
          inProgress,
        }),
      ),
    });
  }
}
