import type { ModulePrerequisite } from '@u7-scl/domain/course/contract';
import { GetModulePrerequisiteUcDef } from '@u7-scl/domain/course/contract';
import {
  EnrollStudentUcDef,
  PassedModulesDqs,
  type StreamAr,
  StreamErrors,
  type StreamModuleDef,
  StudentAr,
} from '@u7-scl/domain/stream';
import { type Caller, err, type Identified, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps } from '../../stream.module';

/** Загруженное — свои данные, контекст правил зачисления. */
type Loaded = {
  readonly stream: StreamAr;
  readonly enrollmentKey?: string;
  readonly userId: string;
  readonly userStudents: readonly StudentAr[];
  readonly userStreams: readonly StreamAr[];
};

/** Контекст правила `prerequisitePassed` — ответ модуля курсов (D-58, `fetch`). */
type Fetched = { readonly prerequisite: ModulePrerequisite };

type Input = ParsedInputOf<typeof EnrollStudentUcDef>;

export class EnrollStudentUc extends UseCaseFromDef<
  typeof EnrollStudentUcDef,
  StreamDeps,
  Loaded,
  Identified,
  Fetched
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(EnrollStudentUcDef, deps, module);
  }

  /** Свои данные: поток, субъект, его записи и потоки этих записей. */
  protected async load(
    { streamId, enrollmentKey }: Input,
    caller: Caller<Identified>,
  ) {
    const { streams, students } = this.resolve;
    const stream = await streams.findById(streamId);
    if (!stream) return err(StreamErrors.NOT_FOUND.make({ streamId }));
    const userId = this.subject(caller).uuid;
    const userStudents = await students.findByUser(userId);
    const streamIds = [...new Set(userStudents.map((s) => s.view().streamId))];
    const found = await Promise.all(
      streamIds.map((id) => streams.findById(id)),
    );
    const userStreams = found.filter((s): s is StreamAr => s !== undefined);
    return ok({ stream, enrollmentKey, userId, userStudents, userStreams });
  }

  /** Условие допуска — `this.call` (фасад `course`, D-43) после Policy (D-58). */
  protected override async fetch(
    _: Input,
    { stream, userStudents, userStreams }: Loaded,
    caller: Caller<Identified>,
    trace: Trace,
  ) {
    const passedModuleIds = new PassedModulesDqs(
      userStudents,
      userStreams,
    ).moduleIds();
    const prerequisite = await this.call(
      GetModulePrerequisiteUcDef,
      { moduleId: stream.view().moduleId, passedModuleIds },
      caller,
      trace,
    );
    if (!prerequisite.ok) return prerequisite;
    return ok({ prerequisite: prerequisite.value });
  }

  protected async execute(
    _: Input,
    { stream, userId }: Loaded,
    uow: UnitOfWork,
  ) {
    const firstStepId = stream.firstStepId();
    if (firstStepId === undefined) {
      throw new Error('Правило streamHasSteps пропустило поток без шагов');
    }
    const enrolled = StudentAr.enroll(
      {
        uuid: crypto.randomUUID(),
        streamId: stream.uuid,
        userId,
        moduleId: stream.view().moduleId,
        firstStepId,
      },
      this.now(),
    );
    if (!enrolled.ok) return enrolled;
    uow.register(enrolled.value, this.resolve.students);
    return ok({ studentId: enrolled.value.uuid });
  }
}
