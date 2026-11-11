import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UserAr, type UserState } from '@u7-scl/domain/user';
import { VersionConflict } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import { ValiError } from 'valibot';
import { UserJsonRepo } from './user.json-repo';

// Перенос `infra/db/user-json-repo.test.ts`: фильтры, сортировка, лимит,
// round-trip. Не переносятся: isTelegramIdTaken, isEmpty и seed;
// «невалидные пропускаются» — теперь исключение.

const tmpDir = mkdtempSync(join(tmpdir(), 'user-json-repo-test-'));
const filePath = (name = 'users.json') => join(tmpDir, name);

const T = (month: number, day: number, hour = 12) =>
  Date.UTC(2026, month - 1, day, hour);

function makeState(overrides: Partial<UserState> = {}): UserState {
  return {
    uuid: crypto.randomUUID(),
    name: 'Тестовый пользователь',
    telegramId: Math.floor(Math.random() * 1_000_000) + 1,
    roles: ['GUEST'],
    createdAt: T(5, 1),
    updatedAt: T(5, 1),
    version: 0,
    ...overrides,
  };
}

/** Записывает состояния «как есть» (не через агрегат) и возвращает репозиторий. */
async function repoWith(name: string, rows: unknown[]) {
  const path = filePath(name);
  await Bun.write(path, JSON.stringify(rows));
  return new UserJsonRepo(path);
}

const ivan = makeState({ name: 'Иван', telegramId: 123, roles: ['GUEST'] });
const petr = makeState({ name: 'Петр', telegramId: 456, roles: ['MENTOR'] });
const maria = makeState({ name: 'Мария', telegramId: 789, roles: ['ADMIN'] });
const petrGuest = makeState({
  name: 'Петр Гость',
  telegramId: 111,
  roles: ['GUEST'],
  createdAt: T(1, 1, 10),
});
const anna = makeState({
  name: 'Анна',
  telegramId: 222,
  roles: ['MENTOR'],
  createdAt: T(3, 15, 14),
});
const boris = makeState({
  name: 'Борис',
  telegramId: 333,
  roles: ['GUEST', 'MENTOR'],
  createdAt: T(6, 1, 8),
});
const six = [ivan, petr, maria, petrGuest, anna, boris];

describe('UserJsonRepo', () => {
  afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

  describe('save и findById', () => {
    test('сохраняет и находит пользователя по uuid', async () => {
      const repo = new UserJsonRepo(filePath());
      const user = expectOk(
        UserAr.create(
          {
            uuid: crypto.randomUUID(),
            name: 'Иван',
            telegramId: 1,
            nick: 'ivan',
          },
          T(5, 1),
        ),
      );

      await repo.save(user);
      const found = await repo.findById(user.uuid);

      expect(found?.snapshot()).toEqual(user.snapshot());
    });

    test('findById несуществующего — undefined', async () => {
      const repo = new UserJsonRepo(filePath('empty.json'));

      expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
    });

    test('save перезаписывает существующего по uuid, версия растёт', async () => {
      const repo = await repoWith('update.json', [ivan, petr]);
      const loaded = await repo.findById(ivan.uuid);
      if (!loaded) throw new Error('запись не найдена');
      expectOk(loaded.addRole('ADMIN', T(5, 2)));

      await repo.save(loaded);

      const found = (await repo.findById(ivan.uuid))?.snapshot();
      expect(found?.roles).toEqual(['GUEST', 'ADMIN']);
      expect(found?.version).toBe(1);
      expect((await repo.findById(petr.uuid))?.snapshot()).toEqual(petr);
    });

    test('в файл пишутся числовые даты', async () => {
      const path = filePath('numbers.json');
      const repo = new UserJsonRepo(path);
      const user = UserAr.restore(makeState());
      await repo.save(
        expectOk(
          UserAr.create(
            { uuid: user.uuid, name: 'Иван', telegramId: 5 },
            T(5, 1),
          ),
        ),
      );

      const [row] = JSON.parse(await Bun.file(path).text()) as UserState[];
      expect(row?.createdAt).toBe(T(5, 1));
      expect(row?.updatedAt).toBe(T(5, 1));
    });
  });

  describe('findByTelegramId и findByIds', () => {
    test('находит по telegramId; нет — undefined', async () => {
      const repo = await repoWith('by-tg.json', six);

      expect((await repo.findByTelegramId(123))?.uuid).toBe(ivan.uuid);
      expect(await repo.findByTelegramId(999_999)).toBeUndefined();
    });

    test('findByIds — только найденные, несуществующие пропускаются', async () => {
      const repo = await repoWith('by-ids.json', six);

      const found = await repo.findByIds([
        ivan.uuid,
        crypto.randomUUID(),
        maria.uuid,
      ]);

      expect(found.map((u) => u.uuid).sort()).toEqual(
        [ivan.uuid, maria.uuid].sort(),
      );
    });

    test('findByIds пустого списка — пустой массив', async () => {
      const repo = await repoWith('by-ids-empty.json', six);

      expect(await repo.findByIds([])).toEqual([]);
    });
  });

  describe('findAll: фильтры', () => {
    const names = async (
      name: string,
      filter: Parameters<UserJsonRepo['findAll']>[0],
    ) =>
      (await (await repoWith(name, six)).findAll(filter)).map(
        (u) => u.view().name,
      );

    test('по роли — включает пользователей с этой ролью среди нескольких', async () => {
      expect((await names('role.json', { role: 'MENTOR' })).sort()).toEqual(
        ['Анна', 'Борис', 'Петр'].sort(),
      );
    });

    test('по имени — точное совпадение', async () => {
      expect(await names('name-exact.json', { name: 'Иван' })).toEqual([
        'Иван',
      ]);
    });

    test('по имени — подстрока', async () => {
      expect((await names('name-part.json', { name: 'Петр' })).sort()).toEqual(
        ['Петр', 'Петр Гость'].sort(),
      );
    });

    test('по имени — регистронезависимо', async () => {
      expect(await names('name-case.json', { name: 'мария' })).toEqual([
        'Мария',
      ]);
    });

    test('по telegramId — точное совпадение', async () => {
      expect(await names('tg.json', { telegramId: 123 })).toEqual(['Иван']);
    });

    test('пустой фильтр — все записи', async () => {
      expect(await names('all.json', {})).toHaveLength(6);
    });
  });

  describe('findAll: сортировка', () => {
    const sorted = async (
      name: string,
      sort: 'createdAt:asc' | 'createdAt:desc' | 'name:asc',
    ) =>
      (await (await repoWith(name, six)).findAll({ sort })).map((u) =>
        u.view(),
      );

    test('createdAt по возрастанию', async () => {
      const dates = (await sorted('sort-asc.json', 'createdAt:asc')).map(
        (u) => u.createdAt,
      );

      expect(dates).toEqual([
        T(1, 1, 10),
        T(3, 15, 14),
        T(5, 1),
        T(5, 1),
        T(5, 1),
        T(6, 1, 8),
      ]);
    });

    test('createdAt по убыванию', async () => {
      const users = await sorted('sort-desc.json', 'createdAt:desc');

      expect(users[0]?.name).toBe('Борис');
      expect(users.at(-1)?.name).toBe('Петр Гость');
    });

    test('name по возрастанию', async () => {
      const users = await sorted('sort-name.json', 'name:asc');

      expect(users[0]?.name).toBe('Анна');
      expect(users.at(-1)?.name).toBe('Петр Гость');
    });
  });

  describe('findAll: лимит и комбинации', () => {
    test('limit ограничивает число записей', async () => {
      const repo = await repoWith('limit.json', six);

      expect(await repo.findAll({ limit: 2 })).toHaveLength(2);
    });

    test('limit=0 — пустой массив', async () => {
      const repo = await repoWith('limit-zero.json', six);

      expect(await repo.findAll({ limit: 0 })).toHaveLength(0);
    });

    test('роль + сортировка по имени', async () => {
      const repo = await repoWith('role-sort.json', six);

      const found = await repo.findAll({ role: 'GUEST', sort: 'name:asc' });

      expect(found.map((u) => u.view().name)).toEqual([
        'Борис',
        'Иван',
        'Петр Гость',
      ]);
    });

    test('имя + лимит', async () => {
      const repo = await repoWith('name-limit.json', six);

      expect(await repo.findAll({ name: 'Петр', limit: 1 })).toHaveLength(1);
    });

    test('все фильтры вместе', async () => {
      const repo = await repoWith('combo.json', six);

      const found = await repo.findAll({
        role: 'MENTOR',
        name: 'борис',
        telegramId: 333,
        sort: 'createdAt:asc',
        limit: 5,
      });

      expect(found.map((u) => u.view().name)).toEqual(['Борис']);
    });
  });

  describe('legacy-записи', () => {
    const legacy = {
      uuid: crypto.randomUUID(),
      name: 'Старый',
      telegramId: 42,
      roles: ['GUEST'],
      createdAt: '2026-05-01T12:00',
    };

    test('ISO без зоны, без updatedAt и version — числа, версия 0', async () => {
      const repo = await repoWith('legacy.json', [legacy]);

      const found = (await repo.findById(legacy.uuid))?.snapshot();

      expect(found?.createdAt).toBe(Date.UTC(2026, 4, 1, 12));
      expect(found?.updatedAt).toBe(Date.UTC(2026, 4, 1, 12));
      expect(found?.version).toBe(0);
    });

    test('round-trip: после save другой записи legacy-запись в файле — числа', async () => {
      const path = filePath('legacy-roundtrip.json');
      const repo = await repoWith('legacy-roundtrip.json', [legacy]);
      const other = expectOk(
        UserAr.create(
          { uuid: crypto.randomUUID(), name: 'Новый', telegramId: 43 },
          T(5, 3),
        ),
      );

      await repo.save(other);

      const rows = JSON.parse(await Bun.file(path).text()) as UserState[];
      const old = rows.find((r) => r.uuid === legacy.uuid);
      expect(old?.createdAt).toBe(Date.UTC(2026, 4, 1, 12));
      expect(old?.updatedAt).toBe(Date.UTC(2026, 4, 1, 12));
      expect(old?.version).toBe(0);
      expect(rows).toHaveLength(2);
    });
  });

  describe('версия (D-36)', () => {
    test('запись по устаревшей версии — VersionConflict, сохранённое не затёрто', async () => {
      const repo = await repoWith('stale.json', [ivan]);
      const first = await repo.findById(ivan.uuid);
      const second = await repo.findById(ivan.uuid);
      if (!first || !second) throw new Error('запись не найдена');
      expectOk(first.addRole('MENTOR', T(5, 2)));
      expectOk(second.addRole('ADMIN', T(5, 2)));
      await repo.save(first);

      await expect(repo.save(second)).rejects.toBeInstanceOf(VersionConflict);
      expect((await repo.findById(ivan.uuid))?.snapshot().roles).toEqual([
        'GUEST',
        'MENTOR',
      ]);
    });

    test('create с занятым uuid — VersionConflict', async () => {
      const repo = await repoWith('busy.json', [ivan]);
      const clash = expectOk(
        UserAr.create(
          { uuid: ivan.uuid, name: 'Двойник', telegramId: 9 },
          T(5, 2),
        ),
      );

      await expect(repo.save(clash)).rejects.toBeInstanceOf(VersionConflict);
    });
  });

  describe('битая запись', () => {
    test('невалидная запись — ValiError на чтении и записи, файл не изменён', async () => {
      const path = filePath('broken.json');
      const text = JSON.stringify([ivan, { uuid: 'not-a-uuid', roles: [] }]);
      await Bun.write(path, text);
      const repo = new UserJsonRepo(path);

      await expect(repo.findById(ivan.uuid)).rejects.toBeInstanceOf(ValiError);
      await expect(repo.findAll({})).rejects.toBeInstanceOf(ValiError);
      await expect(
        repo.save(
          expectOk(
            UserAr.create(
              { uuid: crypto.randomUUID(), name: 'Н', telegramId: 8 },
              T(5, 2),
            ),
          ),
        ),
      ).rejects.toBeInstanceOf(ValiError);

      expect(await Bun.file(path).text()).toBe(text);
    });

    test('невалидный JSON — исключение, файл не изменён', async () => {
      const path = filePath('bad-json.json');
      const text = '[{"uuid": ';
      await Bun.write(path, text);
      const repo = new UserJsonRepo(path);

      await expect(repo.findByTelegramId(1)).rejects.toThrow();

      expect(await Bun.file(path).text()).toBe(text);
    });
  });
});
