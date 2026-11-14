import {
  type ContentSnapshot,
  GetModuleSnapshotUcDef,
} from '@u7-scl/domain/course/contract';
import {
  PreviewStreamContentSyncUcDef,
  type StreamAr,
  StreamContentSyncDcs,
  StreamErrors,
  type StreamModuleDef,
  type StudentAr,
} from '@u7-scl/domain/stream';
import { type Caller, err, ok } from 'dmg-core';
import { type ParsedInputOf, type Trace, UseCaseFromDef } from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = {
  readonly stream: StreamAr;
  readonly students: readonly StudentAr[];
};
type Fetched = { readonly snapshot: ContentSnapshot };
type Input = ParsedInputOf<typeof PreviewStreamContentSyncUcDef>;

/**
 * Предпросмотр обновления контента потока (F-80): план без записи.
 * `streamVersion` клиент возвращает в `expectedVersion` применения.
 */
export class PreviewStreamContentSyncUc extends UseCaseFromDef<
  typeof PreviewStreamContentSyncUcDef,
  StreamDeps,
  Loaded,
  StreamUser,
  Fetched
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(PreviewStreamContentSyncUcDef, deps, module);
  }

  protected async load({ streamId }: Input) {
    const stream = await this.resolve.streams.findById(streamId);
    if (!stream) return err(StreamErrors.NOT_FOUND.make({ streamId }));
    const students = await this.resolve.students.findByStream(streamId);
    return ok({ stream, students });
  }

  protected override async fetch(
    _: Input,
    { stream }: Loaded,
    caller: Caller<StreamUser>,
    trace: Trace,
  ) {
    const snapshot = await this.call(
      GetModuleSnapshotUcDef,
      { moduleId: stream.view().moduleId },
      caller,
      trace,
    );
    if (!snapshot.ok) return snapshot;
    return ok({ snapshot: snapshot.value });
  }

  protected async execute(
    _: Input,
    { stream, students, snapshot }: Loaded & Fetched,
  ) {
    return ok({
      plan: new StreamContentSyncDcs(stream, students).plan(snapshot),
      streamVersion: stream.version,
    });
  }
}
