// DEBT-40: репозиторий во временном каталоге — перевести на фейк порта (`<a>.repo.fake.ts`) при касании.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WishModuleDef, type WishState } from '@u7-scl/domain/wish';
import { GuestCaller, type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import { WishJsonRepo } from '../../infra/wish.json-repo';
import { ListUserWishesUc } from './list-user-wishes.uc';

// Перенос случаев legacy `api/wish/list-user-wishes-uc.test.ts` на UC по Def.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const ACTOR_ID = crypto.randomUUID();
const ACTOR: Identified = { uuid: ACTOR_ID };
const asActor = new UserCaller<Identified>(ACTOR);

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'list-user-wishes-'));
  file = join(dir, 'wishes.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeUc() {
  const { app } = testAppContext();
  return new ListUserWishesUc(
    { app, facades: new ModuleFacades(), wishes: new WishJsonRepo(file) },
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
    const wishes = [
      makeWish(),
      makeWish({ status: 'confirmed' }),
      makeWish({ target: { kind: 'module', moduleId: crypto.randomUUID() } }),
    ];
    await Bun.write(file, JSON.stringify(wishes));

    const res = expectOk(await makeUc().handle({}, asActor, REQ));

    expect(res).toEqual(wishes);
  });

  it('чужие желания не попадают в выдачу', async () => {
    const own = makeWish();
    await Bun.write(
      file,
      JSON.stringify([makeWish({ userId: crypto.randomUUID() }), own]),
    );

    const res = expectOk(await makeUc().handle({}, asActor, REQ));

    expect(res).toEqual([own]);
  });

  it('желаний нет — пустой список', async () => {
    const res = expectOk(await makeUc().handle({}, asActor, REQ));

    expect(res).toEqual([]);
  });

  it('вызывающий guest — UNAUTHORIZED', async () => {
    await Bun.write(file, JSON.stringify([makeWish()]));

    const res = await makeUc().handle({}, new GuestCaller(), REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
  });

  it('query ничего не пишет: файл не изменился', async () => {
    const raw = JSON.stringify([makeWish()]);
    await Bun.write(file, raw);

    expectOk(await makeUc().handle({}, asActor, REQ));

    expect(await Bun.file(file).text()).toBe(raw);
  });
});
