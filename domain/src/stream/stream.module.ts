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
import { GetStreamMembersUcDef } from './stream/uc/get-stream-members.uc';
import { GetStreamPresenceUcDef } from './stream/uc/get-stream-presence.uc';
import { ListStreamsUcDef } from './stream/uc/list-streams.uc';
import { StudentArDef } from './student/student.ar';

/**
 * Модуль потоков. Поток переведён на Def (9 UC); студент — legacy-код, поэтому
 * модуль остаётся внешним (`external`, D-37) до Ф3 трека `stream-dmg`.
 */
export const StreamModuleDef = ModuleDef.define({
  name: 'stream',
  label: 'Потоки',
  description: 'Потоки обучения по модулям курсов и участие студентов в них.',
  external: true,
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
  ],
  reactions: [],
  jobs: [],
});
