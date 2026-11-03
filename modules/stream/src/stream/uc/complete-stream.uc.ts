import {
  CompleteStreamUcDef,
  type StreamAr,
  StreamErrors,
  type StreamModuleDef,
  type StreamStudentFact,
} from '@u7-scl/domain/stream';
import { err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = { readonly stream: StreamAr };

/** Факты студентов — контекст правила `studentsSettled`. */
type Fetched = { readonly students: readonly StreamStudentFact[] };

type Input = ParsedInputOf<typeof CompleteStreamUcDef>;

export class CompleteStreamUc extends UseCaseFromDef<
  typeof CompleteStreamUcDef,
  StreamDeps,
  Loaded,
  StreamUser,
  Fetched
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(CompleteStreamUcDef, deps, module);
  }

  protected async load({ streamId }: Input) {
    const stream = await this.resolve.streams.findById(streamId);
    return stream
      ? ok({ stream })
      : err(StreamErrors.NOT_FOUND.make({ streamId }));
  }

  /** Студенты — свой порт, не чужой модуль: спрашиваем после права. */
  protected override async fetch({ streamId }: Input) {
    return ok({ students: await this.resolve.students.factsOf(streamId) });
  }

  protected async execute(_: Input, { stream }: Loaded, uow: UnitOfWork) {
    const completed = stream.complete(this.now());
    if (!completed.ok) return completed;
    uow.register(stream, this.resolve.streams);
    return ok({});
  }
}
