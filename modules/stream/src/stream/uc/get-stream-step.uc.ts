import {
  GetSnapshotStepsUcDef,
  StepErrors,
  type StepView,
} from '@u7-scl/domain/course/contract';
import {
  GetStreamStepUcDef,
  type StreamAr,
  StreamErrors,
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
  readonly stepId: string;
};
type Fetched = { readonly view: StepView };
type Input = ParsedInputOf<typeof GetStreamStepUcDef>;

/**
 * Шаг потока по снимку. Запись вызывающего и шаг — контекст `canReadStep`
 * (студенту — только выданный); шаг вне снимка отсекается в `load`, до права.
 * Курс спрашивается после права.
 */
export class GetStreamStepUc extends UseCaseFromDef<
  typeof GetStreamStepUcDef,
  StreamDeps,
  Loaded,
  StreamUser,
  Fetched
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(GetStreamStepUcDef, deps, module);
  }

  protected async load(
    { streamId, stepId }: Input,
    caller: Caller<StreamUser>,
  ) {
    const stream = await this.resolve.streams.findById(streamId);
    if (!stream) return err(StreamErrors.NOT_FOUND.make({ streamId }));
    // Шаг вне снимка — отказ загрузки: раньше замка, чтобы не раскрывать его.
    if (!stream.hasStep(stepId)) {
      return err(StepErrors.NOT_FOUND.make({ stepId }));
    }
    const records = await this.resolve.students.findByUser(
      this.subject(caller).uuid,
    );
    const student = records.find((it) => it.belongsToStream(streamId));
    return ok({ stream, student, stepId });
  }

  protected override async fetch(
    { stepId }: Input,
    _: Loaded,
    caller: Caller<StreamUser>,
    trace: Trace,
  ) {
    const steps = await this.call(
      GetSnapshotStepsUcDef,
      { stepIds: [stepId] },
      caller,
      trace,
    );
    if (!steps.ok) return steps;
    const view = steps.value[0];
    return view ? ok({ view }) : err(StepErrors.NOT_FOUND.make({ stepId }));
  }

  protected async execute(
    _: Input,
    { view }: Loaded & Fetched,
    __: UnitOfWork,
  ) {
    return ok(view);
  }
}
