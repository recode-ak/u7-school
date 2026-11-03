import { ListStreamsUcDef, type StreamModuleDef } from '@u7-scl/domain/stream';
import { ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Input = ParsedInputOf<typeof ListStreamsUcDef>;

export class ListStreamsUc extends UseCaseFromDef<
  typeof ListStreamsUcDef,
  StreamDeps,
  undefined,
  StreamUser
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(ListStreamsUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(filter: Input, _: undefined, __: UnitOfWork) {
    const streams = await this.resolve.streams.findAll(filter);
    return ok(streams.map((stream) => stream.view()));
  }
}
