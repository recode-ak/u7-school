import { describe, expect, mock, test } from 'bun:test';
import type { WishApiModuleResolver, WishState } from '@u7-scl/domain/wish';
import type { QuestionnaireAbandonEvent } from '@u7-scl/questionnaire/domain';
import { AbandonWishEr } from './abandon-wish-er';

type AbandonEvent = QuestionnaireAbandonEvent<{ courseId: string }>;

function makeEvent(): AbandonEvent {
  return {
    eventId: crypto.randomUUID(),
    eventName: 'questionnaire:abandon',
    occurredAt: '2026-08-26T12:00',
    aggregateName: 'Questionnaire',
    aggregateId: crypto.randomUUID(),
    ownerInfo: { courseId: crypto.randomUUID() },
    payload: {
      questionnaireId: crypto.randomUUID(),
      respondentId: crypto.randomUUID(),
    },
  };
}

function setupEr(wish?: WishState) {
  const save = mock(async (_wish: WishState): Promise<void> => {});
  const getByUserAndTarget = mock(
    async (
      _userId: string,
      _target: WishState['target'],
    ): Promise<WishState | undefined> => wish,
  );

  const er = new AbandonWishEr();
  er.init({
    wishRepo: { save, getByUserAndTarget },
  } as unknown as WishApiModuleResolver);

  return { save, getByUserAndTarget, er };
}

function makePendingWish(event: AbandonEvent): WishState {
  return {
    uuid: crypto.randomUUID(),
    userId: event.payload.respondentId,
    target: { kind: 'course', courseId: event.ownerInfo.courseId },
    status: 'pending',
    createdAt: Date.UTC(2026, 7, 20, 10),
    updatedAt: Date.UTC(2026, 7, 20, 10),
    version: 0,
  };
}

describe('AbandonWishEr', () => {
  test('бросает ожидающее желание (pending → abandoned)', async () => {
    const event = makeEvent();
    const wish = makePendingWish(event);
    const { save, er } = setupEr(wish);

    await er.handle(event);

    expect(save).toHaveBeenCalledTimes(1);
    const saved = (save as ReturnType<typeof mock>).mock
      .calls[0]![0] as WishState;
    expect(saved.uuid).toBe(wish.uuid);
    expect(saved.status).toBe('abandoned');
  });

  test('идемпотентность: не-pending желание — игнор без сохранения', async () => {
    const event = makeEvent();
    const { save, getByUserAndTarget, er } = setupEr();
    getByUserAndTarget.mockResolvedValueOnce({
      ...makePendingWish(event),
      status: 'cancelled' as const,
    });

    await er.handle(event);

    expect(save).toHaveBeenCalledTimes(0);
  });

  test('желание не найдено — игнор без ошибок', async () => {
    const { save, er } = setupEr();

    await er.handle(makeEvent());

    expect(save).toHaveBeenCalledTimes(0);
  });
});
