import { describe, expect, mock, test } from 'bun:test';
import type { WishState } from '@u7-scl/domain/wish';
import { WishAr } from '@u7-scl/domain/wish';
import type { QuestionnaireCompleteEvent } from '@u7-scl/questionnaire/domain';
import type { WishApiModuleResolver } from '../../wish';
import { ConfirmWishEr } from './confirm-wish-er';

type CompleteEvent = QuestionnaireCompleteEvent<{ courseId: string }>;

function makeEvent(): CompleteEvent {
  return {
    eventId: crypto.randomUUID(),
    eventName: 'questionnaire:complete',
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
  const save = mock(async (_wish: WishAr): Promise<void> => {});
  const publish = mock(async (_event: unknown): Promise<void> => {});
  const findCurrentByUserAndTarget = mock(
    async (
      _userId: string,
      _target: WishState['target'],
    ): Promise<WishAr | undefined> => (wish ? WishAr.restore(wish) : undefined),
  );

  const er = new ConfirmWishEr();
  er.init({
    wishRepo: { save, findCurrentByUserAndTarget },
    userFacade: { getUserByUuid: mock() },
    eventBus: { publish },
    appResolver: { logger: { info: mock(), warn: mock(), error: mock() } },
  } as unknown as WishApiModuleResolver);

  return { save, findCurrentByUserAndTarget, publish, er };
}

function makePendingWish(event: CompleteEvent): WishState {
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

describe('ConfirmWishEr', () => {
  test('подтверждает ожидающее желание (pending → confirmed)', async () => {
    const event = makeEvent();
    const wish = makePendingWish(event);
    const { save, er } = setupEr(wish);

    await er.handle(event);

    expect(save).toHaveBeenCalledTimes(1);
    const saved = (
      (save as ReturnType<typeof mock>).mock.calls[0]![0] as WishAr
    ).snapshot();
    expect(saved.uuid).toBe(wish.uuid);
    expect(saved.status).toBe('confirmed');
  });

  test('идемпотентность: не-pending желание — игнор без сохранения', async () => {
    const event = makeEvent();
    const { save, findCurrentByUserAndTarget, er } = setupEr();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore({
        ...makePendingWish(event),
        status: 'confirmed' as const,
      }),
    );

    await er.handle(event);

    expect(save).toHaveBeenCalledTimes(0);
  });

  test('желание не найдено — игнор без ошибок', async () => {
    const { save, publish, er } = setupEr();

    await er.handle(makeEvent());

    expect(save).toHaveBeenCalledTimes(0);
    expect(publish).toHaveBeenCalledTimes(0);
  });

  test('при подтверждении публикует wish.wish.confirmed (FQN) с адресацией', async () => {
    const event = makeEvent();
    const wish = makePendingWish(event);
    const { publish, er } = setupEr(wish);

    await er.handle(event);

    expect(publish).toHaveBeenCalledTimes(1);
    const published = (publish as ReturnType<typeof mock>).mock
      .calls[0]![0] as {
      eventName: string;
      aggregateName: string;
      aggregateId: string;
      payload: { userId: string; courseId: string };
    };
    expect(published.eventName).toBe('wish.wish.confirmed');
    expect(published.aggregateName).toBe('wish.wish');
    expect(published.aggregateId).toBe(wish.uuid);
    expect(published.payload).toEqual({
      userId: wish.userId,
      courseId: event.ownerInfo.courseId,
    });
  });

  test('игнор (не-pending) — событие не публикуется', async () => {
    const event = makeEvent();
    const { publish, findCurrentByUserAndTarget, er } = setupEr();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore({
        ...makePendingWish(event),
        status: 'confirmed' as const,
      }),
    );

    await er.handle(event);

    expect(publish).toHaveBeenCalledTimes(0);
  });
});
