import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type WishAr,
  WishModuleDef,
  type WishState,
  type WishStatus,
  type WishTargetVo,
} from '@u7-scl/domain/wish';
import { GuestCaller, type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import { WishJsonRepo } from '../../infra/wish.json-repo';
import { CancelWishUc } from './cancel-wish.uc';

// Перенос случаев legacy `api/wish/cancel-wish-uc.test.ts` на UC по Def.
// «Чужое желание» — отказ Policy: репозиторий искал бы по субъекту и его не
// нашёл, поэтому чужое желание подсовывается подменой поиска.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const courseId = '22222222-2222-4222-8222-222222222222';
const moduleId = '33333333-3333-4333-8333-333333333333';
const courseTarget: WishTargetVo = { kind: 'course', courseId };
const moduleTarget: WishTargetVo = { kind: 'module', moduleId };

const ACTOR_ID = crypto.randomUUID();
const ACTOR: Identified = { uuid: ACTOR_ID };
const asActor = new UserCaller<Identified>(ACTOR);

let dir: string;
let file: string;
let wishes: WishJsonRepo;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cancel-wish-'));
  file = join(dir, 'wishes.json');
  wishes = new WishJsonRepo(file);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeUc(repo: WishJsonRepo = wishes) {
  const { app } = testAppContext();
  return new CancelWishUc(
    { app, facades: new ModuleFacades(), wishes: repo },
    WishModuleDef,
  );
}

/** Желание в файле: по умолчанию — актора на курс. */
async function seed(
  status: WishStatus,
  target: WishTargetVo = courseTarget,
  userId: string = ACTOR_ID,
): Promise<void> {
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
  await Bun.write(file, JSON.stringify([state]));
}

/** Статусы желаний актора на цель — то, что реально записано. */
async function statuses(target: WishTargetVo = courseTarget) {
  const found = await wishes.findAllByUserAndTarget(ACTOR_ID, target);
  return found.map((wish) => wish.snapshot().status);
}

describe('CancelWishUc', () => {
  it.each(['expressed', 'confirmed'] as const)(
    'отменяет %s-желание на курс',
    async (status) => {
      await seed(status);

      expect(
        expectOk(await makeUc().handle(courseTarget, asActor, REQ)),
      ).toEqual({});

      expect(await statuses()).toEqual(['cancelled']);
    },
  );

  it('отменяет желание на модуль по варианту { kind: module }', async () => {
    await seed('expressed', moduleTarget);

    expectOk(await makeUc().handle(moduleTarget, asActor, REQ));

    expect(await statuses(moduleTarget)).toEqual(['cancelled']);
  });

  it('желание в статусе pending — WISH_NOT_FOUND, статус не меняется', async () => {
    await seed('pending');

    const res = await makeUc().handle(courseTarget, asActor, REQ);

    expect(expectErr(res, 'WISH_NOT_FOUND').payload).toEqual({
      userId: ACTOR_ID,
      courseId,
    });
    expect(await statuses()).toEqual(['pending']);
  });

  it('желания нет — WISH_NOT_FOUND: kind и payload цели', async () => {
    const res = await makeUc().handle(courseTarget, asActor, REQ);

    const error = expectErr(res, 'WISH_NOT_FOUND');
    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ userId: ACTOR_ID, courseId });
  });

  it('желание на другую цель не отменяется — WISH_NOT_FOUND', async () => {
    await seed('expressed', moduleTarget);

    const res = await makeUc().handle(courseTarget, asActor, REQ);

    expectErr(res, 'WISH_NOT_FOUND');
    expect(await statuses(moduleTarget)).toEqual(['expressed']);
  });

  it('чужое желание — отказ Policy: ACCESS_DENIED, ничего не сохранено', async () => {
    const authorId = crypto.randomUUID();
    await seed('expressed', courseTarget, authorId);
    const foreign = new (class extends WishJsonRepo {
      override findAllByUserAndTarget(
        _userId: string,
        target: WishTargetVo,
      ): Promise<WishAr[]> {
        return super.findAllByUserAndTarget(authorId, target);
      }
    })(file);

    const res = await makeUc(foreign).handle(courseTarget, asActor, REQ);

    const error = expectErr(res, 'ACCESS_DENIED');
    expect(error.payload).toMatchObject({ rule: 'isAuthor' });
    const rows = JSON.parse(await Bun.file(file).text()) as WishState[];
    expect(rows.map((r) => r.status)).toEqual(['expressed']);
  });

  it('вызывающий guest — UNAUTHORIZED, ничего не записано', async () => {
    await seed('expressed');

    const res = await makeUc().handle(courseTarget, new GuestCaller(), REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
    expect(await statuses()).toEqual(['expressed']);
  });
});

// Ожидаемая версия от клиента (D-57): устаревшее действие отклоняется без записи.
describe('CancelWishUc — ожидаемая версия', () => {
  const seededUuid = async () =>
    (JSON.parse(await Bun.file(file).text()) as WishState[])[0]?.uuid ?? '';

  it('совпала (версия 0 из seed) — желание отменено', async () => {
    await seed('expressed');

    expectOk(
      await makeUc().handle(
        { ...courseTarget, expectedVersion: 0 },
        asActor,
        REQ,
      ),
    );

    expect(await statuses()).toEqual(['cancelled']);
  });

  it('расходится — VERSION_CONFLICT, статус не изменился', async () => {
    await seed('expressed');

    const res = await makeUc().handle(
      { ...courseTarget, expectedVersion: 1 },
      asActor,
      REQ,
    );

    expect(expectErr(res, 'VERSION_CONFLICT').payload).toEqual({
      aggregate: 'wish',
      uuid: await seededUuid(),
    });
    expect(await statuses()).toEqual(['expressed']);
  });
});
