import type { User } from '@u7-scl/app-legacy/domain';
import type {
  QuestionnaireActionResponse,
  StartByInviteCmdMeta,
} from '@u7-scl/domain/questionnaire';
import {
  QuestionnaireActionResponseSchema,
  QuestionnaireFactory,
  type StartByInviteCmd,
  StartByInviteCmdSchema,
} from '@u7-scl/domain/questionnaire';
import { QuestionnaireUseCase } from '../questionnaire-uc';

export class StartByInviteUc extends QuestionnaireUseCase<StartByInviteCmdMeta> {
  protected readonly ucName = 'start-by-invite' as const;
  protected readonly ucLabel = 'Запустить анкету по приглашению' as const;
  protected readonly arMeta = {
    arName: 'Questionnaire' as const,
    arLabel: 'Анкета' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = StartByInviteCmdSchema;
  protected readonly outputSchema = QuestionnaireActionResponseSchema;

  async execute(
    command: StartByInviteCmd,
    actor: User,
  ): Promise<QuestionnaireActionResponse> {
    const state = await this.getQuestionnaireForEdit(
      command.questionnaireId,
      actor,
    );
    const ar = QuestionnaireFactory.restore(state);
    const response = ar.start();
    await this.repo.save(ar.state);
    return response;
  }
}
