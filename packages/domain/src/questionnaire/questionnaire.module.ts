import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { defineModule } from 'dmg-core';
import { QuestionnaireArDef } from './questionnaire/questionnaire.ar';

/**
 * Внешний модуль анкет (D-37): реализован legacy-кодом, здесь только
 * контракт — агрегат с событиями. При миграции `external` снимается.
 */
export const QuestionnaireModuleDef = defineModule({
  name: 'questionnaire',
  label: 'Анкеты',
  description: 'Анкеты респондентов: запуск, заполнение, завершение.',
  external: true,
  dependsOn: [UserModuleDef],
  aggregates: [QuestionnaireArDef],
  useCases: [],
  reactions: [],
  jobs: [],
});
