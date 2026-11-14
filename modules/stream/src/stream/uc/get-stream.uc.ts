import {
  GetStreamUcDef,
  type StreamAr,
  StreamErrors,
  type StreamModuleDef,
  StreamPolicy,
} from '@u7-scl/domain/stream';
import { type Caller, err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = { readonly stream: StreamAr };
type Input = ParsedInputOf<typeof GetStreamUcDef>;

export class GetStreamUc extends UseCaseFromDef<
  typeof GetStreamUcDef,
  StreamDeps,
  Loaded,
  StreamUser
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(GetStreamUcDef, deps, module);
  }

  protected async load({ streamId }: Input) {
    const stream = await this.resolve.streams.findById(streamId);
    return stream
      ? ok({ stream })
      : err(StreamErrors.NOT_FOUND.make({ streamId }));
  }

  /**
   * Право управления считает Policy, UI его не вычисляет (гость — `false`).
   * `canX` = право И переход допустим; `isEnrolling` от права не зависит.
   */
  protected async execute(
    _: Input,
    { stream }: Loaded,
    __: UnitOfWork,
    caller: Caller<StreamUser>,
  ) {
    const { allowed } = StreamPolicy.rules.canManage.evaluate(
      caller.subject(),
      {
        stream,
      },
    );
    return ok({
      ...stream.view(),
      canManage: allowed,
      canActivate: allowed && stream.canActivate(),
      canComplete: allowed && stream.canComplete(),
      canArchive: allowed && stream.canArchive(),
      isEnrolling: stream.isEnrolling(),
    });
  }
}
