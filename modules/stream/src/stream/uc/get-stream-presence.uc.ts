import {
  GetStreamPresenceUcDef,
  type StreamModuleDef,
} from '@u7-scl/domain/stream';
import { ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps } from '../../stream.module';

type Input = ParsedInputOf<typeof GetStreamPresenceUcDef>;

/** Есть ли поток; отсутствие — `exists: false`, не ошибка. */
export class GetStreamPresenceUc extends UseCaseFromDef<
  typeof GetStreamPresenceUcDef,
  StreamDeps,
  undefined
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(GetStreamPresenceUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ streamId }: Input, _: undefined, __: UnitOfWork) {
    const stream = await this.resolve.streams.findById(streamId);
    return ok({ exists: stream !== undefined });
  }
}
