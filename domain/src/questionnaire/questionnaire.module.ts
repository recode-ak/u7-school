import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';
import { QuestionnaireArDef } from './questionnaire/questionnaire.ar';
import { StartQuestionnaireUcDef } from './questionnaire/uc/start-questionnaire.uc';

/**
 * Внешний модуль анкет (D-37): реализован legacy-кодом, здесь только
 * контракт — агрегат с событиями и Def UC без реализации, которые вызывают
 * другие модули (D-42; исполняет адаптер над legacy-фасадом, TR-11). При
 * миграции `external` снимается.
 */
export const QuestionnaireModuleDef = ModuleDef.define({
  name: 'questionnaire',
  label: 'Анкеты',
  description: 'Анкеты респондентов: запуск, заполнение, завершение.',
  external: true,
  dependsOn: [UserModuleDef],
  aggregates: [QuestionnaireArDef],
  useCases: [StartQuestionnaireUcDef],
  reactions: [],
  jobs: [],
});
