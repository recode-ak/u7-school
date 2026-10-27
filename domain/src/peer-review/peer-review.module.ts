import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';

/**
 * Внешний модуль взаимных проверок (D-37): реализован legacy-кодом, здесь
 * только паспорт для графа зависимостей. Агрегатов, UC, ER и Job в Def нет.
 * При миграции `external` снимается.
 */
export const PeerReviewModuleDef = ModuleDef.define({
  name: 'peer-review',
  label: 'Взаимные проверки',
  description: 'Кампании и рецензии взаимных проверок студентов.',
  external: true,
  dependsOn: [UserModuleDef, QuestionnaireModuleDef, StreamModuleDef],
  aggregates: [],
  useCases: [],
  reactions: [],
  jobs: [],
});
