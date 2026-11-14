import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';
import { StreamArDef } from './stream/stream.ar';
import { ActivateStreamUcDef } from './stream/uc/activate-stream.uc';
import { ArchiveStreamUcDef } from './stream/uc/archive-stream.uc';
import { CompleteStreamUcDef } from './stream/uc/complete-stream.uc';
import { CreateStreamUcDef } from './stream/uc/create-stream.uc';
import { FindStreamByTelegramGroupUcDef } from './stream/uc/find-stream-by-telegram-group.uc';
import { GetStreamUcDef } from './stream/uc/get-stream.uc';
import { GetStreamLessonStepsUcDef } from './stream/uc/get-stream-lesson-steps.uc';
import { GetStreamMembersUcDef } from './stream/uc/get-stream-members.uc';
import { GetStreamPresenceUcDef } from './stream/uc/get-stream-presence.uc';
import { GetStreamStepUcDef } from './stream/uc/get-stream-step.uc';
import { ListStreamsUcDef } from './stream/uc/list-streams.uc';
import { InactivitySweepJobDef } from './student/job/inactivity-sweep.job';
import { StudentArDef } from './student/student.ar';
import { CompleteStepUcDef } from './student/uc/complete-step.uc';
import { CompleteStudentUcDef } from './student/uc/complete-student.uc';
import { DropStudentUcDef } from './student/uc/drop-student.uc';
import { EnrollStudentUcDef } from './student/uc/enroll-student.uc';
import { GetActiveStudentUcDef } from './student/uc/get-active-student.uc';
import { GetStudentByUserUcDef } from './student/uc/get-student-by-user.uc';
import { GetStudentProgressUcDef } from './student/uc/get-student-progress.uc';
import { MarkAbandonedUcDef } from './student/uc/mark-abandoned.uc';

/** Модуль потоков: поток (11 UC) и студент (8 UC, Job бездействия). */
export const StreamModuleDef = ModuleDef.define({
  name: 'stream',
  label: 'Потоки',
  description: 'Потоки обучения по модулям курсов и участие студентов в них.',
  dependsOn: [UserModuleDef, CourseModuleDef],
  aggregates: [StreamArDef, StudentArDef],
  useCases: [
    CreateStreamUcDef,
    ActivateStreamUcDef,
    CompleteStreamUcDef,
    ArchiveStreamUcDef,
    GetStreamUcDef,
    ListStreamsUcDef,
    GetStreamMembersUcDef,
    GetStreamPresenceUcDef,
    FindStreamByTelegramGroupUcDef,
    GetStreamStepUcDef,
    GetStreamLessonStepsUcDef,
    EnrollStudentUcDef,
    CompleteStepUcDef,
    CompleteStudentUcDef,
    DropStudentUcDef,
    MarkAbandonedUcDef,
    GetStudentByUserUcDef,
    GetStudentProgressUcDef,
    GetActiveStudentUcDef,
  ],
  reactions: [],
  jobs: [InactivitySweepJobDef],
});
