import type { User } from '@u7-scl/app-legacy/domain';
import type {
  GetQuestionnairesByUserCmdMeta,
  QuestionnaireState,
} from '@u7-scl/domain/questionnaire';
import {
  type GetQuestionnairesByUserCmd,
  GetQuestionnairesByUserCmdSchema,
  QuestionnaireStateSchema,
} from '@u7-scl/domain/questionnaire';
import * as v from 'valibot';
import { QuestionnaireUseCase } from '../questionnaire-uc';

export class GetQuestionnairesByUserUc extends QuestionnaireUseCase<GetQuestionnairesByUserCmdMeta> {
  protected readonly ucName = 'get-questionnaires-by-user' as const;
  protected readonly ucLabel = 'Получить анкеты пользователя' as const;
  protected readonly arMeta = {
    arName: 'Questionnaire' as const,
    arLabel: 'Анкета' as const,
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = GetQuestionnairesByUserCmdSchema;
  protected readonly outputSchema = v.array(QuestionnaireStateSchema);

  async execute(
    command: GetQuestionnairesByUserCmd,
    actor: User,
  ): Promise<QuestionnaireState[]> {
    this.ensureCanListForUser(actor, command.userId);
    return this.repo.getByRespondentId(command.userId);
  }
}
