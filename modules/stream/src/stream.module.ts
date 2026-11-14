import { StreamModuleDef } from '@u7-scl/domain/stream';
import type { UserAr } from '@u7-scl/domain/user/contract';
import type { ReadonlyAr } from 'dmg-core';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import type { StreamRepo } from './stream/stream.repo';
import { ActivateStreamUc } from './stream/uc/activate-stream.uc';
import { ArchiveStreamUc } from './stream/uc/archive-stream.uc';
import { CompleteStreamUc } from './stream/uc/complete-stream.uc';
import { CreateStreamUc } from './stream/uc/create-stream.uc';
import { FindStreamByTelegramGroupUc } from './stream/uc/find-stream-by-telegram-group.uc';
import { GetStreamUc } from './stream/uc/get-stream.uc';
import { GetStreamLessonStepsUc } from './stream/uc/get-stream-lesson-steps.uc';
import { GetStreamMembersUc } from './stream/uc/get-stream-members.uc';
import { GetStreamPresenceUc } from './stream/uc/get-stream-presence.uc';
import { GetStreamStepUc } from './stream/uc/get-stream-step.uc';
import { ListStreamsUc } from './stream/uc/list-streams.uc';
import { PreviewStreamContentSyncUc } from './stream/uc/preview-stream-content-sync.uc';
import { SyncStreamContentUc } from './stream/uc/sync-stream-content.uc';
import { InactivitySweepJob } from './student/job/inactivity-sweep.job';
import type { StudentRepo } from './student/student.repo';
import { CompleteStepUc } from './student/uc/complete-step.uc';
import { CompleteStudentUc } from './student/uc/complete-student.uc';
import { DropStudentUc } from './student/uc/drop-student.uc';
import { EnrollStudentUc } from './student/uc/enroll-student.uc';
import { GetActiveStudentUc } from './student/uc/get-active-student.uc';
import { GetStudentByUserUc } from './student/uc/get-student-by-user.uc';
import { GetStudentProgressUc } from './student/uc/get-student-progress.uc';
import { MarkAbandonedUc } from './student/uc/mark-abandoned.uc';

/** Субъект потока: права спрашиваются у `UserAr` (`StreamPolicy`). */
export type StreamUser = ReadonlyAr<UserAr>;

/**
 * Резолвер модуля: платформа (фасад `course` — в `facades`, вызываемый UC — в
 * `calls`), репозитории потоков и студентов и школа приложения.
 */
export type StreamDeps = ModuleDeps & {
  readonly streams: StreamRepo;
  readonly students: StudentRepo;
  readonly schoolId: string;
};

/** Карта «Def → класс» модуля stream (API-05); ER нет, Job — обход бездействующих студентов. */
export const streamMap = {
  useCases: {
    createStream: CreateStreamUc,
    activateStream: ActivateStreamUc,
    completeStream: CompleteStreamUc,
    archiveStream: ArchiveStreamUc,
    getStream: GetStreamUc,
    listStreams: ListStreamsUc,
    getStreamMembers: GetStreamMembersUc,
    getStreamPresence: GetStreamPresenceUc,
    getStreamStep: GetStreamStepUc,
    getStreamLessonSteps: GetStreamLessonStepsUc,
    findStreamByTelegramGroup: FindStreamByTelegramGroupUc,
    previewStreamContentSync: PreviewStreamContentSyncUc,
    syncStreamContent: SyncStreamContentUc,
    enrollStudent: EnrollStudentUc,
    completeStep: CompleteStepUc,
    completeStudent: CompleteStudentUc,
    dropStudent: DropStudentUc,
    markAbandoned: MarkAbandonedUc,
    getStudentByUser: GetStudentByUserUc,
    getStudentProgress: GetStudentProgressUc,
    getActiveStudent: GetActiveStudentUc,
  },
  reactions: {},
  jobs: { inactivitySweep: InactivitySweepJob },
} satisfies ModuleMap<typeof StreamModuleDef, StreamDeps, StreamUser>;

/**
 * Модуль потоков: поток и студент на своих репозиториях.
 */
export function createStreamModule(deps: StreamDeps) {
  return new ModuleFromDef<typeof StreamModuleDef, StreamDeps, StreamUser>(
    StreamModuleDef,
    streamMap,
    deps,
  );
}
