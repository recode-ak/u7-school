import type { User } from '@u7-scl/app-legacy/domain';
import { isoNow } from '@u7-scl/core/shared';
import type {
  QuestionnaireInviteEvent,
  SendLikertInviteCmdMeta,
} from '@u7-scl/domain/questionnaire';
import {
  QuestionnaireFactory,
  type SendLikertInviteCmd,
  SendLikertInviteCmdSchema,
} from '@u7-scl/domain/questionnaire';
import * as v from 'valibot';
import { QuestionnaireUseCase } from '../questionnaire-uc';

export class SendLikertInviteUc extends QuestionnaireUseCase<SendLikertInviteCmdMeta> {
  protected readonly ucName = 'send-likert-invite' as const;
  protected readonly ucLabel = 'Пригласить на likert-анкету' as const;
  protected readonly arMeta = {
    arName: 'Questionnaire' as const,
    arLabel: 'Анкета' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = SendLikertInviteCmdSchema;
  protected readonly outputSchema = v.undefined();

  async execute(command: SendLikertInviteCmd, actor: User): Promise<undefined> {
    const ar = QuestionnaireFactory.createLikert(
      actor.uuid,
      command.pool,
      command.ownerInfo,
    );
    await this.repo.save(ar.state);
    const response = ar.getInvite();

    const event: QuestionnaireInviteEvent = {
      eventId: crypto.randomUUID(),
      eventName: 'questionnaire:invite',
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
