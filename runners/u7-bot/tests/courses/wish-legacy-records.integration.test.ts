import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import {
  CancelWishUcDef,
  ListUserWishesUcDef,
  WishModuleDef,
} from '@u7-scl/domain/wish/contract';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';

/**
 * Интеграционный тест чтения и перезаписи legacy-записей желаний:
 * сырой файл `wish/wishes.json` (createdAt — ISO без зоны, без updatedAt и
 * version) → приложение разбирает запись схемой state, а после перехода
 * (cancel-wish) переписывает весь файл в формате spec (числа, version).
 */
describe('Wish: legacy-записи в wishes.json (интеграционный)', () => {
  let app: TestApp;
  let guest: U7BotActor;

  const INSTANT_COURSE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const OTHER_COURSE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const TARGET_UUID = '11111111-1111-4111-8111-111111111111';
  const NEIGHBOR_UUID = '22222222-2222-4222-8222-222222222222';
  const CREATED_ISO = '2026-03-01T10:00';
  const NEIGHBOR_ISO = '2026-03-02T11:30';
  // ISO без зоны трактуется как UTC (D-36) — ожидания явно в UTC, не зависят от TZ
  const CREATED_AT = Date.UTC(2026, 2, 1, 10, 0);
  const NEIGHBOR_AT = Date.UTC(2026, 2, 2, 11, 30);

  let wishesPath: string;

  beforeAll(async () => {
    app = await createTestApp('wish-legacy-records');
    guest = await app.userByTelegramId(1001);
    wishesPath = `${app.fixtures.dbDir}/wish/wishes.json`;

    // Сырые legacy-записи: без updatedAt/version, createdAt — ISO без зоны
    await Bun.write(
      wishesPath,
      JSON.stringify([
        {
          uuid: TARGET_UUID,
          userId: guest.user.uuid,
          target: { kind: 'course', courseId: INSTANT_COURSE_ID },
          status: 'expressed',
          createdAt: CREATED_ISO,
        },
        {
          uuid: NEIGHBOR_UUID,
          userId: guest.user.uuid,
          target: { kind: 'course', courseId: OTHER_COURSE_ID },
          status: 'expressed',
          createdAt: NEIGHBOR_ISO,
        },
      ]),
    );
  });

  afterAll(async () => {
    await app.cleanup();
  });

  /** След запроса: в тестах — новый requestId на вызов. */
  const req = () => Trace.fromRequest({ requestId: crypto.randomUUID() });

  const rawRows = async (): Promise<Array<Record<string, unknown>>> =>
    JSON.parse(await Bun.file(wishesPath).text());

  test('чтение: legacy-запись видна, ISO разобран в число', async () => {
    const wishes = expectOk(
      await app.apiApp.dispatch(
        WishModuleDef,
        ListUserWishesUcDef.command({}),
        guest,
        req(),
      ),
    );

    const wish = wishes.find((w) => w.uuid === TARGET_UUID);
    expect(wish).toBeDefined();
    expect(wish!.status).toBe('expressed');
    expect(wish!.createdAt).toBe(CREATED_AT);
  });

  test('cancel-wish: файл переписан в формате spec, соседняя запись не потеряна', async () => {
    expectOk(
      await app.apiApp.dispatch(
        WishModuleDef,
        CancelWishUcDef.command({
          kind: 'course',
          courseId: INSTANT_COURSE_ID,
        }),
        guest,
        req(),
      ),
    );

    const rows = await rawRows();
    expect(rows).toHaveLength(2);

    const target = rows.find((r) => r.uuid === TARGET_UUID)!;
    expect(target.status).toBe('cancelled');
    expect(target.version).toBe(1);
    expect(target.createdAt).toBe(CREATED_AT);
    expect(typeof target.updatedAt).toBe('number');

    const neighbor = rows.find((r) => r.uuid === NEIGHBOR_UUID)!;
    expect(neighbor.status).toBe('expressed');
    expect(neighbor.createdAt).toBe(NEIGHBOR_AT);
    expect(typeof neighbor.updatedAt).toBe('number');
  });
});
