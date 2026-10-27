import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';
import { StreamArDef } from './stream/stream.ar';
import { GetStreamPresenceUcDef } from './stream/uc/get-stream-presence.uc';
import { StudentArDef } from './student/student.ar';

/**
 * Внешний модуль потоков (D-37): реализован legacy-кодом, здесь только
 * контракт — агрегаты с событиями. При миграции `external` снимается.
 */
export const StreamModuleDef = ModuleDef.define({
  name: 'stream',
  label: 'Потоки',
  description: 'Потоки обучения по модулям курсов и участие студентов в них.',
  external: true,
  dependsOn: [UserModuleDef, CourseModuleDef],
  aggregates: [StreamArDef, StudentArDef],
  useCases: [GetStreamPresenceUcDef],
  reactions: [],
  jobs: [],
});
