import {
  type ContentSnapshot,
  GetModuleSnapshotUcDef,
} from '@u7-scl/domain/course/contract';
import {
  CreateStreamUcDef,
  StreamAr,
  type StreamModuleDef,
} from '@u7-scl/domain/stream';
import { type Caller, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Input = ParsedInputOf<typeof CreateStreamUcDef>;

/** Ответ модуля курсов — снимок контента, фиксируемый в потоке. */
type Fetched = { readonly contentSnapshot: ContentSnapshot };

/**
 * Создание потока. Ментор — субъект вызова, школа — из настроек приложения;
 * снимок контента берётся у модуля курсов после проверки права (D-58).
 */
export class CreateStreamUc extends UseCaseFromDef<
  typeof CreateStreamUcDef,
  StreamDeps,
  undefined,
  StreamUser,
  Fetched
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(CreateStreamUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected override async fetch(
    { moduleId }: Input,
    _loaded: undefined,
    caller: Caller<StreamUser>,
    trace: Trace,
  ) {
    const snapshot = await this.call(
      GetModuleSnapshotUcDef,
      { moduleId },
      caller,
      trace,
    );
    if (!snapshot.ok) return snapshot;
    return ok({ contentSnapshot: snapshot.value });
  }

  protected async execute(
    input: Input,
    { contentSnapshot }: Fetched,
    uow: UnitOfWork,
    caller: Caller<StreamUser>,
  ) {
    const created = StreamAr.create(
      {
        ...input,
        uuid: crypto.randomUUID(),
        schoolId: this.resolve.schoolId,
        mentorId: this.subject(caller).uuid,
        contentSnapshot,
      },
      this.now(),
    );
    if (!created.ok) return created;
    uow.register(created.value, this.resolve.streams);
    return ok({ streamId: created.value.uuid });
  }
}
