import { ModuleDef } from 'dmg-core';

/**
 * Внешний модуль досье (D-37): реализован legacy-кодом, здесь только паспорт
 * для графа зависимостей. Агрегатов, UC, ER и Job в Def нет. При миграции
 * `external` снимается.
 */
export const DossierModuleDef = ModuleDef.define({
  name: 'dossier',
  label: 'Досье',
  description: 'Категории и оценки досье студента.',
  external: true,
  dependsOn: [],
  aggregates: [],
  useCases: [],
  reactions: [],
  jobs: [],
});
