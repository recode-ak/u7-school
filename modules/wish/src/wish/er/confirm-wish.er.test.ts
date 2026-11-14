import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import {
  WishEvents,
  WishModuleDef,
  type WishState,
  type WishStatus,
  type WishTargetVo,
} from '@u7-scl/domain/wish';
import { type EnvelopeOf, ModuleFacades } from 'dmg-core/app';
import {
  expectIdempotentReaction,
  expectOk,
  MemoryBus,
  TEST_NOW,
  testAppContext,
} from 'dmg-core/testing';
import { WishRepoFake } from '../wish.repo.fake';
import { ConfirmWishEr } from './confirm-wish.er';
import { trackHandling } from './er.fixture';

const USER = '22222222-2222-4222-8222-222222222222';
const COURSE = '44444444-4444-4444-8444-444444444444';
const OTHER_COURSE = '55555555-5555-4555-8555-555555555555';
const CREATED = Date.UTC(2025, 7, 20, 10);

let wishes: WishRepoFake;
let ctx: ReturnType<typeof testAppContext>;

beforeEach(() => {
  wishes = new WishRepoFake();
  wishes.findAllByUserAndTarget = async () => [];
  ctx = testAppContext();
});

function makeEr() {
  return new ConfirmWishEr(
    { app: ctx.app, facades: new ModuleFacades([]), wishes },
    WishModuleDef,
  );
}

function completed(
  ownerInfo: Record<string, unknown> = { courseId: COURSE },
  respondentId = USER,
): EnvelopeOf<typeof QuestionnaireEvents.completed> {
  const ref = {
    questionnaireId: crypto.randomUUID(),
    respondentId,
    ownerInfo,
    kind: 'standard' as const,
  };
  return {
    ...QuestionnaireEvents.completed.make(ref),
    eventId: crypto.randomUUID(),
    occurredAt: TEST_NOW,
    aggregateId: ref.questionnaireId,
    cause: { kind: 'request', requestId: 'r-1' },
    correlationId: 'c-1',
  };
}

function wish(
  status: WishStatus,
  target: WishTargetVo = { kind: 'course', courseId: COURSE },
  userId = USER,
): WishState {
  return {
    uuid: crypto.randomUUID(),
    userId,
    target,
    status,
    createdAt: CREATED,
    updatedAt: CREATED,
    version: 0,
  };
}

/** Желания в памяти; выборка по цели отдаёт их все (тест с разными целями задаёт ответ сам). */
function seed(...states: WishState[]): void {
  wishes.seed(...states);
  wishes.findAllByUserAndTarget = async () =>
    states.map((s) => wishes.restoredOrThrow(s.uuid));
}

async function statuses(): Promise<Record<string, WishStatus>> {
  const stored = await wishes.findByUser(USER);
  return Object.fromEntries(
    stored.map((w) => [w.snapshot().uuid, w.snapshot().status]),
  );
}

describe('ConfirmWishEr', () => {
  it('pending → confirmed на момент часов приложения', async () => {
    const w = wish('pending');
    seed(w);

    expectOk(await makeEr().handle(completed()));

    const [stored] = await wishes.findByUser(USER);
    expect(stored?.snapshot()).toMatchObject({
      uuid: w.uuid,
      status: 'confirmed',
      updatedAt: TEST_NOW,
    });
  });

  it('публикует wish.confirmed с payload { userId, courseId }', async () => {
    const w = wish('pending');
    seed(w);

    expectOk(await makeEr().handle(completed()));

    expect(ctx.published).toHaveLength(1);
    expect(ctx.published[0]).toMatchObject({
      name: WishEvents.confirmed.name,
      aggregateId: w.uuid,
      payload: { userId: USER, courseId: COURSE },
    });
  });

  it('желание не pending — игнор: ничего не записано и не опубликовано', async () => {
    seed(
      wish('expressed'),
      wish('confirmed', { kind: 'course', courseId: OTHER_COURSE }),
    );

    expectOk(await makeEr().handle(completed()));
    expectOk(await makeEr().handle(completed({ courseId: OTHER_COURSE })));

    expect(wishes.saved).toEqual([]);
    expect(ctx.published).toEqual([]);
  });

  it('желания нет — игнор без ошибок', async () => {
    expectOk(await makeEr().handle(completed()));
    expect(ctx.published).toEqual([]);
  });

  it('среди завершённых желаний на ту же цель выбирает активное pending', async () => {
    const old = wish('cancelled');
    const active = wish('pending');
    seed(old, active);

    expectOk(await makeEr().handle(completed()));

    expect(await statuses()).toEqual({
      [old.uuid]: 'cancelled',
      [active.uuid]: 'confirmed',
    });
  });

  it('чужой ownerInfo — ничего не загружено, не записано, не опубликовано', async () => {
    // Репозиторий не должен вызываться вовсе: ни загрузок, ни записей.
    let loads = 0;
    const spy = Object.assign(Object.create(wishes), {
      findAllByUserAndTarget: async () => {
        loads++;
        return [];
      },
    }) as WishRepoFake;
    const er = new ConfirmWishEr(
      { app: ctx.app, facades: new ModuleFacades([]), wishes: spy },
      WishModuleDef,
    );

    expectOk(await er.handle(completed({ lessonId: 'x' })));
    expectOk(await er.handle(completed({})));

    expect(loads).toBe(0);
    expect(wishes.saved).toEqual([]);
    expect(ctx.published).toEqual([]);
  });
});

describe('ConfirmWishEr.subscribe', () => {
  it('реагирует на questionnaire.completed из шины', async () => {
    const w = wish('pending');
    seed(w);
    const bus = new MemoryBus();
    const er = makeEr();
    const handled = trackHandling(er);
    er.subscribe(bus);

    bus.publish(completed());
    await handled();

    expect(await statuses()).toEqual({ [w.uuid]: 'confirmed' });
  });
});

describe('ConfirmWishEr — идемпотентность (D-47)', () => {
  it('повтор questionnaire.completed с новым eventId — без записей и событий', async () => {
    seed(wish('pending'));
    const er = makeEr();
    await expectIdempotentReaction({
      event: completed(),
      deliver: (event) => er.handle(event),
      published: ctx.published,
      state: () => structuredClone(wishes.saved),
    });
  });
});
