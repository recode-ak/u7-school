import { ModuleDef } from 'dmg-core';

/** Модуль-заготовка: поведения нет. */
export const DossierModuleDef = ModuleDef.define({
  name: 'dossier',
  label: 'Досье',
  description:
    'Агрегация фактов об учёбе студента (peer-review, sessions, stream) в досье; предъявление — модуль passport. Пока — только схемы навыков (категории, баллы); агрегатов, UC, ER и Job нет.',
  dependsOn: [],
  aggregates: [],
  useCases: [],
  reactions: [],
  jobs: [],
});
