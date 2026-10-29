import type { User } from '@u7-scl/app-legacy/domain';
import type {
  GetQuestionnaireCmdMeta,
  QuestionnaireState,
} from '@u7-scl/domain/questionnaire';
import {
  type GetQuestionnaireCmd,
  GetQuestionnaireCmdSchema,
  QuestionnaireStateSchema,
} from '@u7-scl/domain/questionnaire';
import { QuestionnaireUseCase } from '../questionnaire-uc';

export class GetQuestionnaireUc extends QuestionnaireUseCase<GetQuestionnaireCmdMeta> {
  protected readonly ucName = 'get-questionnaire' as const;
  protected readonly ucLabel = 'Получить анкету' as const;
  protected readonly arMeta = {
    arName: 'Questionnaire' as const,
    arLabel: 'Анкета' as const,
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = GetQuestionnaireCmdSchema;
  protected readonly outputSchema = QuestionnaireStateSchema;

  async execute(
    command: GetQuestionnaireCmd,
    actor: User,
  ): Promise<QuestionnaireState> {
    return this.getQuestionnaireForRead(command.uuid, actor);
  }
}
