import { afterAll, describe, expect, test } from 'bun:test';
import type { WishState, WishTargetVo } from '@u7-scl/domain/wish';
import { WishAr } from '@u7-scl/domain/wish';
import { VersionConflict } from 'dmg-core/app';
import { expectOk, TempDir } from 'dmg-core/testing';
import { ValiError } from 'valibot';
import { WishJsonRepo } from './wish.json-repo';

const tmpDir = TempDir.create('wish-json-repo-test-');

function filePath(filename = 'wishes.json'): string {
  return tmpDir.file(filename);
}

function makeTarget(courseId = crypto.randomUUID()): WishTargetVo {
  return { kind: 'course', courseId };
}

function makeState(overrides: Partial<WishState> = {}): WishState {
  return {
    uuid: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    target: makeTarget(),
    status: 'expressed',
    createdAt: Date.UTC(2026, 4, 1, 12),
    updatedAt: Date.UTC(2026, 4, 1, 12),
    version: 0,
    ...overrides,
  };
}

/**
 * Новый агрегат (ещё не записанный): `expressed` или `pending` — через
 * `WishAr.create`. Остальные статусы фабрика не подменяет: их строят
 * переходами Ar или `WishAr.restore(makeState({ status }))` явно.
 */
function makeWish(
  overrides: Partial<
    Pick<WishState, 'uuid' | 'userId' | 'target' | 'createdAt'>
  > & {
    status?: 'expressed' | 'pending';
  } = {},
): WishAr {
  const s = makeState(overrides);
  return expectOk(
    WishAr.create(
      {
        uuid: s.uuid,
        userId: s.userId,
        target: s.target,
        status: overrides.status ?? 'expressed',
      },
      s.createdAt,
    ),
  );
}

/** Записывает состояния «как есть» (не через агрегат) и возвращает репозиторий. */
async function repoWith(name: string, rows: unknown[]): Promise<WishJsonRepo> {
  const path = filePath(name);
  await Bun.write(path, JSON.stringify(rows));
  return new WishJsonRepo(path);
}

describe('WishJsonRepo', () => {
  afterAll(() => {
    tmpDir.dispose();
  });

  describe('save и findById', () => {
    test('сохраняет и находит желание по uuid', async () => {
      const repo = new WishJsonRepo(filePath());
      const wish = makeWish();

      await repo.save(wish);
      const found = await repo.findById(wish.uuid);

      expect(found?.snapshot()).toEqual(wish.snapshot());
      expect(found?.snapshot().status).toBe('expressed');
    });

    test('findById возвращает undefined для несуществующего', async () => {
      const repo = new WishJsonRepo(filePath());

      const found = await repo.findById('550e8400-e29b-41d4-a716-446655440099');
      expect(found).toBeUndefined();
    });

    test('save перезаписывает существующее желание', async () => {
      const repo = new WishJsonRepo(filePath('wishes-update.json'));
      await repo.save(
        makeWish({ uuid: '550e8400-e29b-41d4-a716-446655440001' }),
      );

      const loaded = await repo.findById(
        '550e8400-e29b-41d4-a716-446655440001',
      );
      if (!loaded) throw new Error('запись не найдена');
      expectOk(loaded.cancel(Date.now()));
      await repo.save(loaded);

      const found = await repo.findById('550e8400-e29b-41d4-a716-446655440001');
      expect(found?.snapshot().status).toBe('cancelled');
      expect(found?.snapshot().version).toBe(1);
    });
  });

  describe('версия (D-36)', () => {
    test('запись по устаревшей версии — VersionConflict', async () => {
      const repo = new WishJsonRepo(filePath('wishes-stale.json'));
      const wish = makeWish();
      await repo.save(wish);

      const first = await repo.findById(wish.uuid);
      const second = await repo.findById(wish.uuid);
      if (!first || !second) throw new Error('запись не найдена');
      expectOk(first.cancel(Date.now()));
      expectOk(second.fulfill(Date.now()));
      await repo.save(first);

      await expect(repo.save(second)).rejects.toBeInstanceOf(VersionConflict);
      expect((await repo.findById(wish.uuid))?.snapshot().status).toBe(
        'cancelled',
      );
    });

    test('create с занятым uuid — VersionConflict, запись не изменена', async () => {
      const repo = new WishJsonRepo(filePath('wishes-busy-uuid.json'));
      const wish = makeWish();
      await repo.save(wish);
      const before = await Bun.file(filePath('wishes-busy-uuid.json')).text();

      const clash = makeWish({ uuid: wish.uuid });
      await expect(repo.save(clash)).rejects.toBeInstanceOf(VersionConflict);

      expect(await Bun.file(filePath('wishes-busy-uuid.json')).text()).toBe(
        before,
      );
    });

    test('восстановленный агрегат, записи нет — VersionConflict', async () => {
      const path = filePath('wishes-restored-missing.json');
      const repo = new WishJsonRepo(path);
      const restored = WishAr.restore(makeState({ version: 1 }));

      await expect(repo.save(restored)).rejects.toBeInstanceOf(VersionConflict);
      expect(await Bun.file(path).exists()).toBe(false);
    });

    test('параллельные записи разных желаний не теряют друг друга', async () => {
      const repo = new WishJsonRepo(filePath('wishes-parallel.json'));
      const userId = crypto.randomUUID();
      await Promise.all([
        repo.save(makeWish({ userId })),
        repo.save(makeWish({ userId })),
      ]);
      expect(await repo.findByUser(userId)).toHaveLength(2);
    });
  });

  describe('legacy-записи', () => {
    test('читает запись с ISO без зоны, без updatedAt и version', async () => {
      const uuid = crypto.randomUUID();
      const repo = await repoWith('wishes-legacy.json', [
        {
          uuid,
          userId: crypto.randomUUID(),
          target: makeTarget(),
          status: 'expressed',
          createdAt: '2026-05-01T12:00',
        },
      ]);

      const found = (await repo.findById(uuid))?.snapshot();

      expect(found?.createdAt).toBe(Date.UTC(2026, 4, 1, 12));
      expect(found?.updatedAt).toBe(Date.UTC(2026, 4, 1, 12));
      expect(found?.version).toBe(0);
    });

    test('legacy-запись читается после save другой записи', async () => {
      const uuid = crypto.randomUUID();
      const target = makeTarget();
      const repo = await repoWith('wishes-legacy-save.json', [
        {
          uuid,
          userId: crypto.randomUUID(),
          target,
          status: 'expressed',
          createdAt: '2026-05-01T12:00',
        },
      ]);
      const other = makeWish();

      await repo.save(other);
      const found = (await repo.findById(uuid))?.snapshot();

      expect(found?.target).toEqual(target);
      expect(found?.status).toBe('expressed');
      expect(found?.createdAt).toBe(Date.UTC(2026, 4, 1, 12));
      expect(found?.updatedAt).toBe(Date.UTC(2026, 4, 1, 12));
      expect(found?.version).toBe(0);
      expect((await repo.findById(other.uuid))?.uuid).toBe(other.uuid);
    });
  });

  describe('битая запись', () => {
    test('невалидная запись — ValiError, файл не изменён', async () => {
      const path = filePath('wishes-broken.json');
      const text = JSON.stringify([
        makeState(),
        { uuid: 'not-a-uuid', status: 'nonsense' },
      ]);
      await Bun.write(path, text);
      const repo = new WishJsonRepo(path);

      await expect(repo.findByUser(crypto.randomUUID())).rejects.toBeInstanceOf(
        ValiError,
      );
      await expect(repo.save(makeWish())).rejects.toBeInstanceOf(ValiError);

      expect(await Bun.file(path).text()).toBe(text);
    });

    test('невалидный JSON — исключение, файл не изменён', async () => {
      const path = filePath('wishes-bad-json.json');
      const text = '[{"uuid": ';
      await Bun.write(path, text);
      const repo = new WishJsonRepo(path);

      await expect(repo.findById(crypto.randomUUID())).rejects.toThrow();
      await expect(repo.save(makeWish())).rejects.toThrow();

      expect(await Bun.file(path).text()).toBe(text);
    });

    test('корень файла не массив — ValiError, файл не изменён', async () => {
      const path = filePath('wishes-not-array.json');
      const text = JSON.stringify({ wishes: [] });
      await Bun.write(path, text);
      const repo = new WishJsonRepo(path);

      await expect(repo.findById(crypto.randomUUID())).rejects.toBeInstanceOf(
        ValiError,
      );
      await expect(repo.save(makeWish())).rejects.toBeInstanceOf(ValiError);

      expect(await Bun.file(path).text()).toBe(text);
    });
  });

  describe('findAllByUserAndTarget', () => {
    test('возвращает все желания пары в любом статусе', async () => {
      const userId = crypto.randomUUID();
      const target = makeTarget();
      const repo = await repoWith('wishes-all-pair.json', [
        makeState({ userId, target, status: 'cancelled' }),
        makeState({ userId, target, status: 'expressed' }),
        makeState({ userId }),
        makeState({ target }),
      ]);

      expect(await repo.findAllByUserAndTarget(userId, target)).toHaveLength(2);
    });
  });

  describe('findAllByUserAndTarget: module', () => {
    test('цель module не смешивается с course того же id', async () => {
      const userId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const asModule = makeState({
        userId,
        target: { kind: 'module', moduleId: id },
      });
      const repo = await repoWith('wishes-all-module.json', [
        asModule,
        makeState({ userId, target: { kind: 'course', courseId: id } }),
        makeState({
          userId,
          target: { kind: 'module', moduleId: crypto.randomUUID() },
        }),
      ]);

      const found = await repo.findAllByUserAndTarget(userId, {
        kind: 'module',
        moduleId: id,
      });
      expect(found.map((w) => w.uuid)).toEqual([asModule.uuid]);
    });
  });

  describe('findByUser', () => {
    test('возвращает все желания пользователя', async () => {
      const repo = new WishJsonRepo(filePath('wishes-by-user.json'));
      const userId = crypto.randomUUID();

      await repo.save(makeWish({ userId }));
      await repo.save(makeWish({ userId }));
      await repo.save(makeWish({ userId: crypto.randomUUID() }));

      expect(await repo.findByUser(userId)).toHaveLength(2);
    });
  });

  describe('findAllByKind', () => {
    test('возвращает все желания заданного вида (все статусы)', async () => {
      const repo = new WishJsonRepo(filePath('wishes-kind-all.json'));
      await repo.save(makeWish({ target: makeTarget() }));
      await repo.save(
        makeWish({ target: { kind: 'module', moduleId: crypto.randomUUID() } }),
      );

      const found = await repo.findAllByKind('module');
      expect(found).toHaveLength(1);
      expect(found[0]?.snapshot().target.kind).toBe('module');
    });

    test('нет совпадений — пустой массив', async () => {
      const repo = new WishJsonRepo(filePath('wishes-kind-empty.json'));

      expect(await repo.findAllByKind('course')).toEqual([]);
    });
  });
});
