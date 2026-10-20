import type { User } from '@u7-scl/app/domain';
import type { AbandonCmdMeta } from '@u7-scl/domain/questionnaire';
import {
  type AbandonCmd,
  AbandonCmdSchema,
  QuestionnaireFactory,
} from '@u7-scl/domain/questionnaire';
import * as v from 'valibot';
import { QuestionnaireUseCase } from '../questionnaire-uc';

export class AbandonUc extends QuestionnaireUseCase<AbandonCmdMeta> {
  protected readonly ucName = 'abandon' as const;
  protected readonly ucLabel = 'Прервать анкету' as const;
  protected readonly arMeta = {
    arName: 'Questionnaire' as const,
    arLabel: 'Анкета' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = AbandonCmdSchema;
  protected readonly outputSchema = v.undefined();

  async execute(command: AbandonCmd, actor: User): Promise<undefined> {
    const state = await this.getQuestionnaireForEdit(
      command.questionnaireId,
      actor,
    );
    const ar = QuestionnaireFactory.restore(state);
    // Ручное прерывание пользователем — фиксируем причину в состоянии и событии
    ar.abandon('by_user');
    await this.repo.save(ar.state);
    this.publishEvents(ar);
    return undefined;
  }
}
