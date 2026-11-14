import {
  type StreamAr,
  type StreamModuleDef,
  type StudentAr,
  SyncStreamContentUcDef,
} from '@u7-scl/domain/stream';
import { UseCaseFromDef } from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = {
  readonly stream: StreamAr;
  readonly students: readonly StudentAr[];
};

/** Заглушка шага 1 (F-80 Ф2): реализация — шаг 3 брифа. */
export class SyncStreamContentUc extends UseCaseFromDef<
  typeof SyncStreamContentUcDef,
  StreamDeps,
  Loaded,
  StreamUser
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(SyncStreamContentUcDef, deps, module);
  }

  protected load(): never {
    // biome-ignore lint/plugin: ERR-01: временная заглушка до реализации
    throw new Error('not implemented');
  }

  protected execute(): never {
    // biome-ignore lint/plugin: ERR-01: временная заглушка до реализации
    throw new Error('not implemented');
  }
}
