import { beforeEach, describe, expect, it } from 'bun:test';
import {
  WishModuleDef,
  type WishState,
  type WishStatus,
  type WishTargetVo,
} from '@u7-scl/domain/wish';
import { GuestCaller, type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades } from 'dmg-core/app';
import {
  expectErr,
  expectOk,
  TEST_TRACE,
  testAppContext,
} from 'dmg-core/testing';
import { WishRepoFake } from '../wish.repo.fake';
import { CancelWishUc } from './cancel-wish.uc';

// «Чужое желание» — отказ Policy: репозиторий искал бы по субъекту и его не
// нашёл, поэтому чужое желание подсовывается подменой поиска.

const courseId = '22222222-2222-4222-8222-222222222222';
const moduleId = '33333333-3333-4333-8333-333333333333';
const courseTarget: WishTargetVo = { kind: 'course', courseId };
const moduleTarget: WishTargetVo = { kind: 'module', moduleId };

const ACTOR_ID = crypto.randomUUID();
const ACTOR: Identified = { uuid: ACTOR_ID };
const asActor = new UserCaller<Identified>(ACTOR);

let wishes: WishRepoFake;
let seeded: WishState;

beforeEach(() => {
  wishes = new WishRepoFake();
  wishes.findAllByUserAndTarget = async () => [];
});

function makeUc() {
  const { app } = testAppContext();
  return new CancelWishUc(
    { app, facades: new ModuleFacades(), wishes },
    WishModuleDef,
  );
}

/** Желание в памяти (по умолчанию — актора на курс); выборка по цели отдаёт именно его. */
function seed(
  status: WishStatus,
  target: WishTargetVo = courseTarget,
  userId: string = ACTOR_ID,
): void {
  const at = Date.UTC(2026, 0, 1, 10);
  const state: WishState = {
    uuid: crypto.randomUUID(),
    userId,
    target,
    status,
    createdAt: at,
    updatedAt: at,
    version: 0,
  };
  wishes.seed(state);
  wishes.findAllByUserAndTarget = async () => [
    wishes.restoredOrThrow(state.uuid),
  ];
  seeded = state;
}

/** Статус посеянного желания — то, что реально записано. */
function statuses() {
  return [wishes.restoredOrThrow(seeded.uuid).snapshot().status];
}

describe('CancelWishUc', () => {
  it.each(['expressed', 'confirmed'] as const)(
    'отменяет %s-желание на курс',
    async (status) => {
      seed(status);

      expect(
        expectOk(await makeUc().handle(courseTarget, asActor, TEST_TRACE)),
      ).toEqual({});

      expect(statuses()).toEqual(['cancelled']);
    },
  );

  it('отменяет желание на модуль по варианту { kind: module }', async () => {
    seed('expressed', moduleTarget);

    expectOk(await makeUc().handle(moduleTarget, asActor, TEST_TRACE));

    expect(statuses()).toEqual(['cancelled']);
  });

  it('желание в статусе pending — WISH_NOT_FOUND, статус не меняется', async () => {
    seed('pending');

    const res = await makeUc().handle(courseTarget, asActor, TEST_TRACE);

    expect(expectErr(res, 'WISH_NOT_FOUND').payload).toEqual({
      userId: ACTOR_ID,
      courseId,
    });
    expect(statuses()).toEqual(['pending']);
  });

  it('желания нет — WISH_NOT_FOUND: kind и payload цели', async () => {
    const res = await makeUc().handle(courseTarget, asActor, TEST_TRACE);

    const error = expectErr(res, 'WISH_NOT_FOUND');
    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ userId: ACTOR_ID, courseId });
  });

  it('желание на другую цель не отменяется — WISH_NOT_FOUND', async () => {
    seed('expressed', moduleTarget);
    // Выборка по цели курса желания на модуль не находит.
    wishes.findAllByUserAndTarget = async () => [];

    const res = await makeUc().handle(courseTarget, asActor, TEST_TRACE);

    expectErr(res, 'WISH_NOT_FOUND');
    expect(statuses()).toEqual(['expressed']);
  });

  it('чужое желание — отказ Policy: ACCESS_DENIED, ничего не сохранено', async () => {
    const authorId = crypto.randomUUID();
    seed('expressed', courseTarget, authorId);

    const res = await makeUc().handle(courseTarget, asActor, TEST_TRACE);

    const error = expectErr(res, 'ACCESS_DENIED');
    expect(error.payload).toMatchObject({ rule: 'isAuthor' });
    expect(wishes.saved).toEqual([]);
    expect(statuses()).toEqual(['expressed']);
  });

  it('вызывающий guest — UNAUTHORIZED, ничего не записано', async () => {
    seed('expressed');

    const res = await makeUc().handle(
      courseTarget,
      new GuestCaller(),
      TEST_TRACE,
    );

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
    expect(statuses()).toEqual(['expressed']);
  });
});

// Ожидаемая версия от клиента (D-57): устаревшее действие отклоняется без записи.
describe('CancelWishUc — ожидаемая версия', () => {
  it('совпала (версия 0 из seed) — желание отменено', async () => {
    seed('expressed');

    expectOk(
      await makeUc().handle(
        { ...courseTarget, expectedVersion: 0 },
        asActor,
        TEST_TRACE,
      ),
    );

    expect(statuses()).toEqual(['cancelled']);
  });

  it('расходится — VERSION_CONFLICT, статус не изменился', async () => {
    seed('expressed');

    const res = await makeUc().handle(
      { ...courseTarget, expectedVersion: 1 },
      asActor,
      TEST_TRACE,
    );

    expect(expectErr(res, 'VERSION_CONFLICT').payload).toEqual({
      aggregate: 'wish',
      uuid: seeded.uuid,
    });
    expect(statuses()).toEqual(['expressed']);
  });
});
