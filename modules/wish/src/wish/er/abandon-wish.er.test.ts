import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import {
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
import { AbandonWishEr } from './abandon-wish.er';
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
  return new AbandonWishEr(
    { app: ctx.app, facades: new ModuleFacades([]), wishes },
    WishModuleDef,
  );
}

function abandoned(
  ownerInfo: Record<string, unknown> = { courseId: COURSE },
  respondentId = USER,
): EnvelopeOf<typeof QuestionnaireEvents.abandoned> {
  const payload = {
    questionnaireId: crypto.randomUUID(),
    respondentId,
    kind: 'standard' as const,
    ownerInfo,
    reason: 'timeout' as const,
  };
  return {
    ...QuestionnaireEvents.abandoned.make(payload),
    eventId: crypto.randomUUID(),
    occurredAt: TEST_NOW,
    aggregateId: payload.questionnaireId,
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

describe('AbandonWishEr', () => {
  it('pending → abandoned на момент часов приложения', async () => {
    const w = wish('pending');
    seed(w);

    expectOk(await makeEr().handle(abandoned()));

    const [stored] = await wishes.findByUser(USER);
    expect(stored?.snapshot()).toMatchObject({
      uuid: w.uuid,
      status: 'abandoned',
      updatedAt: TEST_NOW,
    });
  });

  it('желание не pending — игнор: ничего не записано и не опубликовано', async () => {
    seed(
      wish('expressed'),
      wish('abandoned', { kind: 'course', courseId: OTHER_COURSE }),
    );

    expectOk(await makeEr().handle(abandoned()));
    expectOk(await makeEr().handle(abandoned({ courseId: OTHER_COURSE })));

    expect(wishes.saved).toEqual([]);
    expect(ctx.published).toEqual([]);
  });

  it('желания нет — игнор без ошибок', async () => {
    expectOk(await makeEr().handle(abandoned()));
    expect(ctx.published).toEqual([]);
  });

  it('среди завершённых желаний на ту же цель выбирает активное pending', async () => {
    const old = wish('cancelled');
    const active = wish('pending');
    seed(old, active);

    expectOk(await makeEr().handle(abandoned()));

    expect(await statuses()).toEqual({
      [old.uuid]: 'cancelled',
      [active.uuid]: 'abandoned',
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
    const er = new AbandonWishEr(
      { app: ctx.app, facades: new ModuleFacades([]), wishes: spy },
      WishModuleDef,
    );

    expectOk(await er.handle(abandoned({ lessonId: 'x' })));
    expectOk(await er.handle(abandoned({})));

    expect(loads).toBe(0);
    expect(wishes.saved).toEqual([]);
    expect(ctx.published).toEqual([]);
  });
});

describe('AbandonWishEr.subscribe', () => {
  it('реагирует на questionnaire.abandoned из шины', async () => {
    const w = wish('pending');
    seed(w);
    const bus = new MemoryBus();
    const er = makeEr();
    const handled = trackHandling(er);
    er.subscribe(bus);

    bus.publish(abandoned());
    await handled();

    expect(await statuses()).toEqual({ [w.uuid]: 'abandoned' });
  });
});

describe('AbandonWishEr — идемпотентность (D-47)', () => {
  it('повтор questionnaire.abandoned с новым eventId — без записей и событий', async () => {
    seed(wish('pending'));
    const er = makeEr();
    await expectIdempotentReaction({
      event: abandoned(),
      deliver: (event) => er.handle(event),
      published: ctx.published,
      state: () => structuredClone(wishes.saved),
    });
  });
});
