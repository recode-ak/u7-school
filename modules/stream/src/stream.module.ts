import { StreamModuleDef } from '@u7-scl/domain/stream';
import type { User } from '@u7-scl/domain/user/contract';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import type { StreamRepo } from './stream/stream.repo';
import type { StreamStudents } from './stream/stream-students';
import { ActivateStreamUc } from './stream/uc/activate-stream.uc';
import { ArchiveStreamUc } from './stream/uc/archive-stream.uc';
import { CompleteStreamUc } from './stream/uc/complete-stream.uc';
import { CreateStreamUc } from './stream/uc/create-stream.uc';
import { FindStreamByTelegramGroupUc } from './stream/uc/find-stream-by-telegram-group.uc';
import { GetStreamUc } from './stream/uc/get-stream.uc';
import { GetStreamMembersUc } from './stream/uc/get-stream-members.uc';
import { GetStreamPresenceUc } from './stream/uc/get-stream-presence.uc';
import { ListStreamsUc } from './stream/uc/list-streams.uc';

/** Субъект потока: права зависят только от `uuid` и ролей (`StreamPolicy`). */
export type StreamUser = Pick<User, 'uuid' | 'roles'>;

/**
 * Резолвер модуля: платформа (фасад `course` — в `facades`, вызываемый UC — в
 * `calls`), репозиторий потоков, порт студентов и школа приложения.
 */
export type StreamDeps = ModuleDeps & {
  readonly streams: StreamRepo;
  readonly students: StreamStudents;
  readonly schoolId: string;
};

/** Карта «Def → класс» модуля stream (API-05); ER и Job нет. */
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
    findStreamByTelegramGroup: FindStreamByTelegramGroupUc,
  },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof StreamModuleDef, StreamDeps, StreamUser>;

/**
 * Модуль потоков: DMG-часть (поток) на своём репозитории; студенты — через
 * порт `StreamStudents` (мост к legacy до Ф2).
 */
export function createStreamModule(deps: StreamDeps) {
  return new ModuleFromDef<typeof StreamModuleDef, StreamDeps, StreamUser>(
    StreamModuleDef,
    streamMap,
    deps,
  );
}
