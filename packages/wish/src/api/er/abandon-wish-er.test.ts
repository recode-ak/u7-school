import { describe, expect, mock, test } from 'bun:test';
import type { WishState } from '@u7-scl/domain/wish';
import { WishAr } from '@u7-scl/domain/wish';
import type { QuestionnaireAbandonEvent } from '@u7-scl/questionnaire/domain';
import type { WishApiModuleResolver } from '../../wish';
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
  const save = mock(async (_wish: WishAr): Promise<void> => {});
  const findCurrentByUserAndTarget = mock(
    async (
      _userId: string,
      _target: WishState['target'],
    ): Promise<WishAr | undefined> => (wish ? WishAr.restore(wish) : undefined),
  );

  const er = new AbandonWishEr();
  er.init({
    wishRepo: { save, findCurrentByUserAndTarget },
  } as unknown as WishApiModuleResolver);

  return { save, findCurrentByUserAndTarget, er };
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
    const saved = (
      (save as ReturnType<typeof mock>).mock.calls[0]![0] as WishAr
    ).snapshot();
    expect(saved.uuid).toBe(wish.uuid);
    expect(saved.status).toBe('abandoned');
  });

  test('идемпотентность: не-pending желание — игнор без сохранения', async () => {
    const event = makeEvent();
    const { save, findCurrentByUserAndTarget, er } = setupEr();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore({
        ...makePendingWish(event),
        status: 'cancelled' as const,
      }),
    );

    await er.handle(event);

    expect(save).toHaveBeenCalledTimes(0);
  });

  test('желание не найдено — игнор без ошибок', async () => {
    const { save, er } = setupEr();

    await er.handle(makeEvent());

    expect(save).toHaveBeenCalledTimes(0);
  });
});
