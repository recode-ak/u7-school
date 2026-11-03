import { U7ApiModule } from '@u7-scl/app-legacy/domain';
import type { ErMeta, EventReaction } from '@u7-scl/core/api';
import type {
  StreamApiModuleMeta,
  StreamApiModuleResolver,
} from '@u7-scl/domain/stream';
import { ListStreamStudentsUc } from './stream/list-stream-students-uc';
import { CompleteStepUc } from './student/complete-step-uc';
import { CompleteStudentUc } from './student/complete-student-uc';
import { DropStudentUc } from './student/drop-student-uc';
import { EnrollStudentUc } from './student/enroll-student-uc';
import { GetStudentByUserUc } from './student/get-student-by-user-uc';
import { GetStudentProgressUc } from './student/get-student-progress-uc';
import { InactivitySweepJob } from './student/inactivity-sweep-job';
import { MarkAbandonedUc } from './student/mark-abandoned-uc';
import { SetNextPreferenceUc } from './student/set-next-preference-uc';

export class StreamApiModule extends U7ApiModule<
  StreamApiModuleMeta,
  StreamApiModuleResolver
> {
  readonly name = 'stream' as const;
  readonly useCases = [
    new ListStreamStudentsUc(),
    new EnrollStudentUc(),
    new GetStudentByUserUc(),
    new CompleteStepUc(),
    new GetStudentProgressUc(),
    new DropStudentUc(),
    new MarkAbandonedUc(),
    new CompleteStudentUc(),
    new SetNextPreferenceUc(),
  ];
  readonly reactions: EventReaction<ErMeta>[] = [];

  /** Периодические задания: ежедневный мониторинг бездействующих студентов */
  readonly jobs = [new InactivitySweepJob()];

  constructor(resolve: StreamApiModuleResolver) {
    super(resolve);
    this.init();
  }
}
