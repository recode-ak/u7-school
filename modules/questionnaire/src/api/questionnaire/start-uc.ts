import type { User } from '@u7-scl/app/domain';
import { isoNow } from '@u7-scl/core/shared';
import type {
  QuestionnaireStartEvent,
  StartCmdMeta,
} from '@u7-scl/domain/questionnaire';
import {
  QuestionnaireFactory,
  type StartCmd,
  StartCmdSchema,
} from '@u7-scl/domain/questionnaire';
import * as v from 'valibot';
import { QuestionnaireUseCase } from '../questionnaire-uc';

export class StartUc extends QuestionnaireUseCase<StartCmdMeta> {
  protected readonly ucName = 'start' as const;
  protected readonly ucLabel = 'Запустить анкету' as const;
  protected readonly arMeta = {
    arName: 'Questionnaire' as const,
    arLabel: 'Анкета' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = StartCmdSchema;
  protected readonly outputSchema = v.undefined();

  async execute(command: StartCmd, actor: User): Promise<undefined> {
    const ar = QuestionnaireFactory.createStandard(
      actor.uuid,
      command.pool,
      command.ownerInfo,
    );
    const response = ar.start();
    await this.repo.save(ar.state);

    const event: QuestionnaireStartEvent = {
      eventId: crypto.randomUUID(),
      eventName: 'questionnaire:start',
      occurredAt: isoNow(),
      aggregateName: 'Questionnaire',
      aggregateId: ar.state.uuid,
      ownerInfo: command.ownerInfo,
      payload: {
        questionnaireId: ar.state.uuid,
        respondentId: actor.uuid,
        telegramId: actor.telegramId,
        response,
      },
    };
    this.resolve.eventBus.publish(event);

    return undefined;
  }
}
