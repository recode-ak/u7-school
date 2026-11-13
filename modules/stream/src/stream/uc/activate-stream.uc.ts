import {
  ActivateStreamUcDef,
  type StreamAr,
  StreamErrors,
  StreamLaunchDcs,
  type StreamModuleDef,
  type StudentAr,
} from '@u7-scl/domain/stream';
import { err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = {
  readonly stream: StreamAr;
  readonly students: readonly StudentAr[];
};
type Input = ParsedInputOf<typeof ActivateStreamUcDef>;

/**
 * Запуск потока. Поток и его студенты меняются `StreamLaunchDcs` и
 * фиксируются одним UoW.
 */
export class ActivateStreamUc extends UseCaseFromDef<
  typeof ActivateStreamUcDef,
  StreamDeps,
  Loaded,
  StreamUser
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(ActivateStreamUcDef, deps, module);
  }

  protected async load({ streamId }: Input) {
    const stream = await this.resolve.streams.findById(streamId);
    if (!stream) return err(StreamErrors.NOT_FOUND.make({ streamId }));
    const students = await this.resolve.students.findByStream(streamId);
    return ok({ stream, students });
  }

  protected async execute(
    _: Input,
    { stream, students }: Loaded,
    uow: UnitOfWork,
  ) {
    const launched = new StreamLaunchDcs(stream, students).launch(this.now());
    if (!launched.ok) {
      // Ошибки студентов недостижимы: DCS трогает только зачисленных и без шагов
      const { error } = launched;
      if (error.code === StreamErrors.NOT_ENROLLING.code) return err(error);
      // biome-ignore lint/plugin: ERR-01: недостижимо — ошибки студентов StreamLaunchDcs не возникают (см. выше)
      throw new Error(`Запуск потока: ${error.code}`);
    }
    uow.register(stream, this.resolve.streams);
    for (const student of launched.value) {
      uow.register(student, this.resolve.students);
    }
    return ok({});
  }
}
