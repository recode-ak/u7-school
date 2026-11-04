import {
  GetStreamMembersUcDef,
  StreamMembersDqs,
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
 * Состав потока: ментор из потока, студенты — факты `StreamMembersDqs` без
 * `settled` (это вопрос правила завершения) и отставание `roster` на момент
 * запроса. Потока нет — `undefined`.
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

    const students = await this.resolve.students.findByStream(streamId);
    return ok({
      mentorId: stream.view().mentorId,
      students: StreamMembersDqs.facts(students).map(
        ({ studentId, userId, status, neverStarted, inProgress }) => ({
          studentId,
          userId,
          status,
          neverStarted,
          inProgress,
        }),
      ),
      roster: StreamMembersDqs.roster(stream, students, this.now()),
    });
  }
}
