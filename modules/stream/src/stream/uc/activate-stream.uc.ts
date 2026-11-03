import {
  ActivateStreamUcDef,
  type StreamAr,
  StreamErrors,
  type StreamModuleDef,
} from '@u7-scl/domain/stream';
import { err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = { readonly stream: StreamAr };
type Input = ParsedInputOf<typeof ActivateStreamUcDef>;

/**
 * Запуск потока. Студентов запускает мост `StreamStudents.launch` в `execute`
 * после `uow.register`, до фиксации (D-41, вариант 1): сбой фиксации оставит
 * студентов активными при незаписанном потоке; повтор безопасен.
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
    return stream
      ? ok({ stream })
      : err(StreamErrors.NOT_FOUND.make({ streamId }));
  }

  protected async execute(
    { streamId }: Input,
    { stream }: Loaded,
    uow: UnitOfWork,
  ) {
    const activated = stream.activate(this.now());
    if (!activated.ok) return activated;
    uow.register(stream, this.resolve.streams);

    const firstStepId = stream.firstStepId();
    if (firstStepId) await this.resolve.students.launch(streamId, firstStepId);
    return ok({});
  }
}
