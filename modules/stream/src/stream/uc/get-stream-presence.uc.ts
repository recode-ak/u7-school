// TR-11: адаптер UC внешнего контракта над legacy-фасадом потоков.
import {
  GetStreamPresenceUcDef,
  type StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { StreamModuleDeps } from '../../stream.module';

type Input = ParsedInputOf<typeof GetStreamPresenceUcDef>;

/**
 * Временная реализация `getStreamPresence` поверх legacy `getStream`:
 * поток найден — `exists: true`, иначе `false` (не ошибка). Уходит с
 * миграцией потоков.
 */
export class GetStreamPresenceUc extends UseCaseFromDef<
  typeof GetStreamPresenceUcDef,
  StreamModuleDeps,
  undefined
> {
  constructor(deps: StreamModuleDeps, module: typeof StreamModuleDef) {
    super(GetStreamPresenceUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ streamId }: Input) {
    const stream = await this.resolve.legacy.getStream(streamId);
    return ok({ exists: stream !== undefined });
  }
}
