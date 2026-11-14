import { beforeEach, describe, expect, it } from 'bun:test';
import { WishModuleDef, type WishState } from '@u7-scl/domain/wish';
import { GuestCaller, type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import { WishRepoFake } from '../wish.repo.fake';
import { ListUserWishesUc } from './list-user-wishes.uc';

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const ACTOR_ID = crypto.randomUUID();
const ACTOR: Identified = { uuid: ACTOR_ID };
const asActor = new UserCaller<Identified>(ACTOR);

let wishes: WishRepoFake;

beforeEach(() => {
  wishes = new WishRepoFake();
});

function makeUc() {
  const { app } = testAppContext();
  return new ListUserWishesUc(
    { app, facades: new ModuleFacades(), wishes },
    WishModuleDef,
  );
}

function makeWish(overrides: Partial<WishState> = {}): WishState {
  const at = Date.UTC(2026, 0, 1, 10);
  return {
    uuid: crypto.randomUUID(),
    userId: ACTOR_ID,
    target: { kind: 'course', courseId: crypto.randomUUID() },
    status: 'expressed',
    createdAt: at,
    updatedAt: at,
    version: 0,
    ...overrides,
  };
}

describe('ListUserWishesUc', () => {
  it('возвращает все желания пользователя (батч для каталога курсов)', async () => {
    const all = [
      makeWish(),
      makeWish({ status: 'confirmed' }),
      makeWish({ target: { kind: 'module', moduleId: crypto.randomUUID() } }),
    ];
    wishes.seed(...all);

    const res = expectOk(await makeUc().handle({}, asActor, REQ));

    expect(res).toEqual(all);
  });

  it('чужие желания не попадают в выдачу', async () => {
    const own = makeWish();
    wishes.seed(makeWish({ userId: crypto.randomUUID() }), own);

    const res = expectOk(await makeUc().handle({}, asActor, REQ));

    expect(res).toEqual([own]);
  });

  it('желаний нет — пустой список', async () => {
    const res = expectOk(await makeUc().handle({}, asActor, REQ));

    expect(res).toEqual([]);
  });

  it('вызывающий guest — UNAUTHORIZED', async () => {
    wishes.seed(makeWish());

    const res = await makeUc().handle({}, new GuestCaller(), REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
  });

  it('query ничего не пишет: файл не изменился', async () => {
    wishes.seed(makeWish());

    expectOk(await makeUc().handle({}, asActor, REQ));

    expect(wishes.saved).toEqual([]);
  });
});
