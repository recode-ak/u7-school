import { describe, expect, test } from 'bun:test';
import { InProcEventBus } from '@u7-scl/core/infra';
import { legacyEventBus } from '@u7-scl/core/legacy-bridge';
import {
  QuestionnaireEvents,
  QuestionnaireFactory,
  type QuestionnairePool,
} from '@u7-scl/domain/questionnaire';
import { systemCaller } from 'dmg-core';
import type { EventEnvelope } from 'dmg-core/app';
import { questionnaireLegacyInbound } from './legacy-inbound';

const RESPONDENT = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const OWNER = { kind: 'wish', wishId: '6f4e2d3c-8b7a-4f9e-8a1b-b2c3d4e5f6a7' };

const pool: QuestionnairePool = {
  inviteText: 'Приглашаем пройти опрос',
  whyText: 'Это улучшит твои метрики',
  questions: [
    {
      question: 'Единственный вопрос',
      questionCode: 'q1',
      type: 'choice',
      multiple: false,
      answers: [{ answer: 'Да', answerCode: 'yes' }],
    },
  ],
};

/** Legacy-шина не ждёт промисы обработчиков — дать им отработать. */
const tick = () => Promise.resolve();

/** Начатая анкета с данными владельца. */
function started() {
  const ar = QuestionnaireFactory.createStandard(RESPONDENT, pool, OWNER);
  ar.start();
  return ar;
}

/** Шина DMG по карте questionnaire и подписчик на Def; `invalid` — шпион onInvalid. */
function subscribed(
  def:
    | typeof QuestionnaireEvents.completed
    | typeof QuestionnaireEvents.abandoned,
) {
  const legacy = new InProcEventBus();
  const got: EventEnvelope[] = [];
  const invalid: string[] = [];
  legacyEventBus(legacy, {
    inbound: questionnaireLegacyInbound,
    onInvalid: (m) => invalid.push(m),
  }).subscribe(def, async (e) => {
    got.push(e);
  });
  return { legacy, got, invalid };
}

describe('questionnaireLegacyInbound', () => {
  test('questionnaire:complete приходит в конверте QuestionnaireEvents.completed', async () => {
    const { legacy, got, invalid } = subscribed(QuestionnaireEvents.completed);
    const ar = started();
    ar.handleAction({ type: 'callback', value: 'yes' });
    const [event] = ar.flushEvents();
    if (!event) throw new Error('анкета не создала событие завершения');
    legacy.publish(event);
    await tick();
    expect(invalid).toEqual([]);
    expect(got).toEqual([
      {
        name: 'questionnaire.questionnaire.completed',
        payload: {
          questionnaireId: ar.state.uuid,
          respondentId: RESPONDENT,
          owner: OWNER,
        },
        eventId: event.eventId,
        occurredAt: Date.parse(event.occurredAt),
        aggregateId: ar.state.uuid,
        caller: systemCaller('legacy:questionnaire:complete'),
        cause: { kind: 'event', eventId: event.eventId },
        correlationId: event.eventId,
      },
    ]);
  });

  test('questionnaire:abandon приходит с причиной, лишние поля legacy отброшены', async () => {
    const { legacy, got, invalid } = subscribed(QuestionnaireEvents.abandoned);
    const ar = started();
    ar.abandon('timeout');
    const [event] = ar.flushEvents();
    if (!event) throw new Error('анкета не создала событие прерывания');
    // Так событие дополняет SweepAbandonedJob перед публикацией.
    legacy.publish({ ...event, payload: { ...event.payload, telegramId: 42 } });
    await tick();
    expect(invalid).toEqual([]);
    expect(got.map((e) => [e.name, e.payload])).toEqual([
      [
        'questionnaire.questionnaire.abandoned',
        {
          questionnaireId: ar.state.uuid,
          respondentId: RESPONDENT,
          owner: OWNER,
          reason: 'timeout',
        },
      ],
    ]);
  });

  test('событие без ownerInfo — onInvalid, подписчик не вызван', async () => {
    const { legacy, got, invalid } = subscribed(QuestionnaireEvents.abandoned);
    const ar = started();
    ar.abandon('by_user');
    const [event] = ar.flushEvents();
    if (!event) throw new Error('анкета не создала событие прерывания');
    const { ownerInfo: _, ...withoutOwner } = event;
    legacy.publish(withoutOwner);
    await tick();
    expect(got).toEqual([]);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toContain('questionnaire:abandon');
  });
});
