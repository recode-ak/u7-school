import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { defineModule } from 'dmg-core';

/**
 * Внешний модуль курсов (D-37): реализован legacy-кодом, здесь только
 * контракт для `dependsOn`. При миграции `external` снимается.
 */
export const CourseModuleDef = defineModule({
  name: 'course',
  label: 'Курсы',
  description: 'Курсы, модули, уроки и шаги учебного контента.',
  external: true,
  dependsOn: [UserModuleDef],
  aggregates: [],
  useCases: [],
  reactions: [],
  jobs: [],
});
