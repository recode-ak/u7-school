import {
  FindStreamByTelegramGroupUcDef,
  type StreamModuleDef,
} from '@u7-scl/domain/stream';
import { ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Input = ParsedInputOf<typeof FindStreamByTelegramGroupUcDef>;

export class FindStreamByTelegramGroupUc extends UseCaseFromDef<
  typeof FindStreamByTelegramGroupUcDef,
  StreamDeps,
  undefined,
  StreamUser
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(FindStreamByTelegramGroupUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(
    { telegramGroupId }: Input,
    _: undefined,
    __: UnitOfWork,
  ) {
    const stream =
      await this.resolve.streams.findByTelegramGroup(telegramGroupId);
    return ok(stream?.view());
  }
}
