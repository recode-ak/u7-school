import type { User } from '@u7-scl/app/domain';
import type {
  GetCurrentCmdMeta,
  QuestionnaireActionResponse,
} from '@u7-scl/domain/questionnaire';
import {
  type GetCurrentCmd,
  GetCurrentCmdSchema,
  QuestionnaireActionResponseSchema,
  QuestionnaireFactory,
} from '@u7-scl/domain/questionnaire';
import { QuestionnaireUseCase } from '../questionnaire-uc';

export class GetCurrentUc extends QuestionnaireUseCase<GetCurrentCmdMeta> {
  protected readonly ucName = 'get-current' as const;
  protected readonly ucLabel = 'Получить текущее состояние анкеты' as const;
  protected readonly arMeta = {
    arName: 'Questionnaire' as const,
    arLabel: 'Анкета' as const,
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = GetCurrentCmdSchema;
  protected readonly outputSchema = QuestionnaireActionResponseSchema;

  async execute(
    command: GetCurrentCmd,
    actor: User,
  ): Promise<QuestionnaireActionResponse> {
    const state = await this.getQuestionnaireForRead(
      command.questionnaireId,
      actor,
    );
    const ar = QuestionnaireFactory.restore(state);
    return ar.getQuestionnaireActionResponse();
  }
}
