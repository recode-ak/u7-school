// TR-11: фасад по D-42 над UC-адаптером legacy-модуля анкет.
import {
  type QuestionnaireModuleDef,
  type QuestionnaireModuleFacade,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import { callUseCase, type UseCaseOwner } from 'dmg-core/app';

/**
 * In-proc реализация фасада анкет по D-42 (API-04): каждый метод — вызов
 * UC модуля от вызывающего `module`, доменных решений нет. Приложение
 * собирает фасад поверх `createQuestionnaireModule` и передаёт его в
 * резолвер модуля-потребителя (у того `questionnaire` в `dependsOn`, UC —
 * в `calls`).
 */
export function questionnaireModuleFacade(
  questionnaire: UseCaseOwner<typeof QuestionnaireModuleDef>,
): QuestionnaireModuleFacade {
  return {
    startQuestionnaire: (call, pool, owner) =>
      callUseCase(
        questionnaire,
        StartQuestionnaireUcDef,
        { pool, owner },
        call,
      ),
  };
}
