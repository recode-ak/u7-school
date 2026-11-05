import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CourseModuleDef,
  GetModuleEnrollmentUcDef,
  type ModuleEnrollment,
} from '@u7-scl/domain/course/contract';
import {
  CreateModuleWishUcDef,
  WishModuleDef,
  type WishState,
  type WishStatus,
} from '@u7-scl/domain/wish';
import {
  CoreErrors,
  GuestCaller,
  type Identified,
  ok,
  UserCaller,
} from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import {
  expectErr,
  expectOk,
  type StubCall,
  StubFacade,
  testAppContext,
} from 'dmg-core/testing';
import { WishJsonRepo } from '../../infra/wish.json-repo';
import { CreateModuleWishUc } from './create-module-wish.uc';

// Перенос случаев legacy `api/wish/create-module-wish-uc.test.ts` на UC по
// Def. Фасад курсов — `StubFacade` по Def из домена (ARC-06). Перевод
// «нет места в программе» в `enrollable: false` проверяет `modules/course`.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const moduleId = '33333333-3333-4333-8333-333333333333';

const ACTOR_ID = crypto.randomUUID();
const ACTOR: Identified = { uuid: ACTOR_ID };
const asActor = new UserCaller<Identified>(ACTOR);

let dir: string;
let file: string;
let wishes: WishJsonRepo;
let course: StubFacade<typeof CourseModuleDef>;

/** Ответ модуля курсов на запрос о записи на модуль. */
const enrollment = (answer: ModuleEnrollment) =>
  course.answer(GetModuleEnrollmentUcDef, () => ok(answer));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'create-module-wish-'));
  file = join(dir, 'wishes.json');
  wishes = new WishJsonRepo(file);
  course = new StubFacade(CourseModuleDef);
  enrollment({ enrollable: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const received = (facade: { readonly received: readonly StubCall[] }) =>
  facade.received.map(({ caller, input }) => ({
    from: caller.from.name,
    person: caller.person(),
    input,
  }));

function makeUc() {
  const { app } = testAppContext();
  const facades = new ModuleFacades([course]);
  return new CreateModuleWishUc({ app, facades, wishes }, WishModuleDef);
}

/** Уже записанное желание актора на модуль — запись в файл. */
async function seed(status: WishStatus): Promise<void> {
  const at = Date.UTC(2026, 0, 1, 10);
  const state: WishState = {
    uuid: crypto.randomUUID(),
    userId: ACTOR_ID,
    target: { kind: 'module', moduleId },
    status,
    createdAt: at,
    updatedAt: at,
    version: 0,
  };
  await Bun.write(file, JSON.stringify([state]));
}

/** Желания актора на модуль — то, что реально записано. */
async function stored() {
  const found = await wishes.findAllByUserAndTarget(ACTOR_ID, {
    kind: 'module',
    moduleId,
  });
  return found.map((wish) => wish.snapshot());
}

describe('CreateModuleWishUc', () => {
  it('создаёт expressed-желание на модуль без анкеты', async () => {
    const res = await makeUc().handle({ moduleId }, asActor, REQ);

    expect(expectOk(res)).toEqual({});
    const saved = await stored();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      userId: ACTOR_ID,
      target: { kind: 'module', moduleId },
      status: 'expressed',
    });
  });

  it('модуль недоступен → WISH_MODULE_NOT_FOUND, ничего не записано', async () => {
    enrollment({ enrollable: false });

    const res = await makeUc().handle({ moduleId }, asActor, REQ);

    const error = expectErr(res, 'WISH_MODULE_NOT_FOUND');
    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ moduleId });
    expect(await stored()).toEqual([]);
  });

  it.each(['expressed', 'pending', 'confirmed'] as const)(
    'WISH_ALREADY_EXISTS при активном желании в статусе %s',
    async (status) => {
      await seed(status);

      const res = await makeUc().handle({ moduleId }, asActor, REQ);

      const error = expectErr(res, 'WISH_ALREADY_EXISTS');
      expect(error.kind).toBe('conflict');
      expect(error.payload).toEqual({ userId: ACTOR_ID, moduleId, status });
      expect(await stored()).toHaveLength(1);
    },
  );

  it('порядок правил: при недоступном модуле и дубле — WISH_MODULE_NOT_FOUND', async () => {
    await seed('expressed');
    enrollment({ enrollable: false });

    const res = await makeUc().handle({ moduleId }, asActor, REQ);

    expectErr(res, 'WISH_MODULE_NOT_FOUND');
  });

  it('модуль спрашивается через фасад от имени UC и вызывающего', async () => {
    await makeUc().handle({ moduleId }, asActor, REQ);

    expect(received(course)).toEqual([
      {
        from: CreateModuleWishUcDef.name,
        person: asActor,
        input: { moduleId },
      },
    ]);
  });

  it('сбой фасада курсов — ошибка как есть, ничего не записано', async () => {
    course.answer(GetModuleEnrollmentUcDef, () =>
      CoreErrors.SERVER_INTERNAL.err(),
    );

    const res = await makeUc().handle({ moduleId }, asActor, REQ);

    expectErr(res, 'SERVER_INTERNAL');
    expect(await stored()).toEqual([]);
  });

  it('вызывающий guest — UNAUTHORIZED, ничего не записано', async () => {
    const res = await makeUc().handle({ moduleId }, new GuestCaller(), REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
    expect(await stored()).toEqual([]);
  });
});
