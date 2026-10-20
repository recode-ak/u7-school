import { defineModule } from 'dmg-core';

/**
 * Внешний модуль пользователей (D-37): реализован legacy-кодом, здесь только
 * контракт для `dependsOn`. При миграции `external` снимается.
 */
export const UserModuleDef = defineModule({
  name: 'user',
  label: 'Пользователи',
  description: 'Учётные записи пользователей школы и их роли.',
  external: true,
  dependsOn: [],
  aggregates: [],
  useCases: [],
  reactions: [],
  jobs: [],
});
