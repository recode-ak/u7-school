import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { defineModule } from 'dmg-core';
import { StreamArDef } from './stream/stream.ar';
import { StudentArDef } from './student/student.ar';

/**
 * Внешний модуль потоков (D-37): реализован legacy-кодом, здесь только
 * контракт — агрегаты с событиями. При миграции `external` снимается.
 */
export const StreamModuleDef = defineModule({
  name: 'stream',
  label: 'Потоки',
  description: 'Потоки обучения по модулям курсов и участие студентов в них.',
  external: true,
  dependsOn: [UserModuleDef, CourseModuleDef],
  aggregates: [StreamArDef, StudentArDef],
  useCases: [],
  reactions: [],
  jobs: [],
});
