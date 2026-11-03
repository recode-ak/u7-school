import {
  ArchiveStreamUcDef,
  type StreamAr,
  StreamErrors,
  type StreamModuleDef,
} from '@u7-scl/domain/stream';
import { err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = { readonly stream: StreamAr };
type Input = ParsedInputOf<typeof ArchiveStreamUcDef>;

export class ArchiveStreamUc extends UseCaseFromDef<
  typeof ArchiveStreamUcDef,
  StreamDeps,
  Loaded,
  StreamUser
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(ArchiveStreamUcDef, deps, module);
  }

  protected async load({ streamId }: Input) {
    const stream = await this.resolve.streams.findById(streamId);
    return stream
      ? ok({ stream })
      : err(StreamErrors.NOT_FOUND.make({ streamId }));
  }

  protected async execute(_: Input, { stream }: Loaded, uow: UnitOfWork) {
    const archived = stream.archive(this.now());
    if (!archived.ok) return archived;
    uow.register(stream, this.resolve.streams);
    return ok({});
  }
}
