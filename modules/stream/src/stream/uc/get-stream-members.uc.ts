// Адаптер UC внешнего контракта над legacy-фасадом потоков.
import {
  GetStreamMembersUcDef,
  type StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { StreamModuleDeps } from '../../stream.module';

type Input = ParsedInputOf<typeof GetStreamMembersUcDef>;

/**
 * `getStreamMembers` поверх legacy `getMembers`: состав
 * передаётся как есть, потока нет — `ok(undefined)` (штатный исход).
 */
export class GetStreamMembersUc extends UseCaseFromDef<
  typeof GetStreamMembersUcDef,
  StreamModuleDeps,
  undefined
> {
  constructor(deps: StreamModuleDeps, module: typeof StreamModuleDef) {
    super(GetStreamMembersUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ streamId }: Input) {
    return ok(await this.resolve.legacy.getMembers(streamId));
  }
}
