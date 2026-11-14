import {
  type ContentSnapshot,
  GetModuleSnapshotUcDef,
} from '@u7-scl/domain/course/contract';
import {
  type StreamAr,
  StreamContentSyncDcs,
  StreamErrors,
  type StreamModuleDef,
  type StudentAr,
  SyncStreamContentUcDef,
} from '@u7-scl/domain/stream';
import { type Caller, err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = {
  readonly stream: StreamAr;
  readonly students: readonly StudentAr[];
};
type Fetched = { readonly snapshot: ContentSnapshot };
type Input = ParsedInputOf<typeof SyncStreamContentUcDef>;

/**
 * Обновление контента потока (F-80). Студенты регистрируются раньше потока
 * (ФР-8а), поток — только если изменился: повтор после сбоя ничего не пишет.
 */
export class SyncStreamContentUc extends UseCaseFromDef<
  typeof SyncStreamContentUcDef,
  StreamDeps,
  Loaded,
  StreamUser,
  Fetched
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(SyncStreamContentUcDef, deps, module);
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
    { confirmedStudentIds, expectedVersion }: Input,
    { stream, students, snapshot }: Loaded & Fetched,
    uow: UnitOfWork,
  ) {
    // Устаревшее действие клиента — отказ до применения (D-57).
    const expected = this.expectVersion(stream, expectedVersion);
    if (!expected.ok) return expected;
    const before = stream.version;
    const applied = new StreamContentSyncDcs(stream, students).apply(
      snapshot,
      confirmedStudentIds,
      this.now(),
    );
    if (!applied.ok) return applied;
    const { mode, changedStudents, credited } = applied.value;
    for (const student of changedStudents) {
      uow.register(student, this.resolve.students);
    }
    if (stream.version !== before) uow.register(stream, this.resolve.streams);
    return ok({ mode, credited: [...credited] });
  }
}
