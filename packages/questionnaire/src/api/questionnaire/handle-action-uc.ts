import type { User } from '@u7-scl/app/domain';
import type {
  HandleActionCmdMeta,
  QuestionnaireActionResponse,
} from '@u7-scl/domain/questionnaire';
import {
  type HandleActionCmd,
  HandleActionCmdSchema,
  QuestionnaireActionResponseSchema,
  QuestionnaireFactory,
} from '@u7-scl/domain/questionnaire';
import { QuestionnaireUseCase } from '../questionnaire-uc';

export class HandleActionUc extends QuestionnaireUseCase<HandleActionCmdMeta> {
  protected readonly ucName = 'handle-action' as const;
  protected readonly ucLabel = 'Обработать действие в анкете' as const;
  protected readonly arMeta = {
    arName: 'Questionnaire' as const,
    arLabel: 'Анкета' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = HandleActionCmdSchema;
  protected readonly outputSchema = QuestionnaireActionResponseSchema;

  async execute(
    command: HandleActionCmd,
    actor: User,
  ): Promise<QuestionnaireActionResponse> {
    const state = await this.getQuestionnaireForEdit(
      command.questionnaireId,
      actor,
    );
    const ar = QuestionnaireFactory.restore(state);
    const response = ar.handleAction({
      type: command.type,
      value: command.value,
    });
    await this.repo.save(ar.state);
    this.publishEvents(ar);
    return response;
  }
}
