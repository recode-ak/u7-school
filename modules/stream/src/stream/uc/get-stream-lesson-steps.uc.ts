import {
  GetSnapshotStepsUcDef,
  type StepView,
} from '@u7-scl/domain/course/contract';
import {
  GetStreamLessonStepsUcDef,
  type StreamAr,
  StreamErrors,
  StreamLessonStepsDqs,
  type StreamModuleDef,
  type StudentAr,
} from '@u7-scl/domain/stream';
import { type Caller, err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { StreamDeps, StreamUser } from '../../stream.module';

type Loaded = {
  readonly stream: StreamAr;
  readonly student: StudentAr | undefined;
};
type Fetched = { readonly steps: readonly StepView[] };
type Input = ParsedInputOf<typeof GetStreamLessonStepsUcDef>;

/**
 * Шаги уроков потока по снимку для навигации: один вызов `getSnapshotSteps`
 * по шагам всех запрошенных уроков, после проверки права.
 */
export class GetStreamLessonStepsUc extends UseCaseFromDef<
  typeof GetStreamLessonStepsUcDef,
  StreamDeps,
  Loaded,
  StreamUser,
  Fetched
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(GetStreamLessonStepsUcDef, deps, module);
  }

  protected async load({ streamId }: Input, caller: Caller<StreamUser>) {
    const stream = await this.resolve.streams.findById(streamId);
    if (!stream) return err(StreamErrors.NOT_FOUND.make({ streamId }));
    const records = await this.resolve.students.findByUser(
      this.subject(caller).uuid,
    );
    const student = records.find((it) => it.belongsToStream(streamId));
    return ok({ stream, student });
  }

  protected override async fetch(
    { lessonIds }: Input,
    { stream }: Loaded,
    caller: Caller<StreamUser>,
    trace: Trace,
  ) {
    const stepIds = [...stream.lessonSteps(lessonIds).values()].flat();
    const steps = await this.call(
      GetSnapshotStepsUcDef,
      { stepIds },
      caller,
      trace,
    );
    if (!steps.ok) return steps;
    return ok({ steps: steps.value });
  }

  protected async execute(
    { lessonIds }: Input,
    { stream, steps }: Loaded & Fetched,
    __: UnitOfWork,
  ) {
    return ok(
      new StreamLessonStepsDqs(stream.lessonSteps(lessonIds), steps).build(),
    );
  }
}
