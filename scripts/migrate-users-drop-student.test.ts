import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  migrateUsersData,
  resolveUsersFilePath,
  runMigration,
} from './migrate-users-drop-student';

// Сырые записи `users.json` — как на проде: даты строками, version может отсутствовать.
const record = (
  uuid: string,
  roles: string[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  uuid,
  name: 'Иван',
  telegramId: 123,
  roles,
  createdAt: '2026-06-25T12:00',
  updatedAt: '2026-06-26T08:30',
  version: 4,
  nick: 'ivan',
  ...extra,
});

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('migrateUsersData', () => {
  test('снимает STUDENT, остальные роли и их порядок сохраняет', () => {
    const { updatedUsers, result } = migrateUsersData([
      record(A, ['MENTOR', 'STUDENT', 'ADMIN']),
    ]);

    expect(updatedUsers[0]?.roles).toEqual(['MENTOR', 'ADMIN']);
    expect(result.total).toBe(1);
    expect(result.migrated).toBe(1);
    expect(result.becameGuest).toBe(0);
    expect(result.invalid).toEqual([]);
  });

  test('единственная роль STUDENT → ["GUEST"], запись считается в becameGuest', () => {
    const { updatedUsers, result } = migrateUsersData([record(A, ['STUDENT'])]);

    expect(updatedUsers[0]?.roles).toEqual(['GUEST']);
    expect(result.migrated).toBe(1);
    expect(result.becameGuest).toBe(1);
  });

  test('записи без STUDENT не меняются (тот же объект, не в migrated)', () => {
    const untouched = record(A, ['GUEST', 'SUBSCRIBER']);
    const { updatedUsers, result } = migrateUsersData([untouched]);

    expect(updatedUsers[0]).toBe(untouched);
    expect(result.total).toBe(1);
    expect(result.migrated).toBe(0);
    expect(result.becameGuest).toBe(0);
  });

  test('даты, version, nick и прочие поля не тронуты, порядок записей сохранён', () => {
    const input = [
      record(A, ['STUDENT']),
      record(B, ['GUEST']),
      record(C, ['STUDENT', 'AUTHOR']),
    ];
    const { updatedUsers } = migrateUsersData(input);

    expect(updatedUsers.map((u) => u.uuid)).toEqual([A, B, C]);
    for (const [i, user] of updatedUsers.entries()) {
      const { roles: _after, ...restAfter } = user;
      const { roles: _before, ...restBefore } = input[i] as Record<
        string,
        unknown
      >;
      expect(restAfter).toEqual(restBefore);
    }
  });

  test('исходный массив не мутируется', () => {
    const input = [record(A, ['STUDENT'])];
    migrateUsersData(input);

    expect(input[0]?.roles).toEqual(['STUDENT']);
  });

  test('запись, невалидная после снятия STUDENT, попадает в invalid и всё равно обновляется', () => {
    const { updatedUsers, result } = migrateUsersData([
      record(A, ['STUDENT', 'OWNER']),
      record(B, ['STUDENT']),
    ]);

    expect(updatedUsers[0]?.roles).toEqual(['OWNER']);
    expect(result.migrated).toBe(2);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0]?.id).toBe(A);
    expect(result.invalid[0]?.issue.length).toBeGreaterThan(0);
  });

  test('невалидная запись без STUDENT тоже перечисляется в invalid, но не меняется', () => {
    const bad = record(A, ['GUEST'], { telegramId: 'не число' });
    const { updatedUsers, result } = migrateUsersData([bad]);

    expect(updatedUsers[0]).toBe(bad);
    expect(result.migrated).toBe(0);
    expect(result.invalid.map((i) => i.id)).toEqual([A]);
  });

  test('legacy-запись без updatedAt/version с ISO createdAt не попадает в invalid', () => {
    const { updatedUsers, result } = migrateUsersData([
      {
        uuid: A,
        name: 'Иван',
        telegramId: 123,
        roles: ['STUDENT'],
        createdAt: '2026-06-25T12:00',
      },
    ]);

    expect(updatedUsers[0]?.roles).toEqual(['GUEST']);
    expect(result.migrated).toBe(1);
    expect(result.invalid).toEqual([]);
  });

  test('запись без uuid в invalid идентифицируется индексом', () => {
    const { result } = migrateUsersData([
      record(A, ['GUEST']),
      { name: 'без uuid', roles: ['GUEST'] },
    ]);

    expect(result.invalid.map((i) => i.id)).toEqual(['1']);
  });

  test('пустой список', () => {
    const { updatedUsers, result } = migrateUsersData([]);

    expect(updatedUsers).toEqual([]);
    expect(result).toEqual({
      total: 0,
      migrated: 0,
      becameGuest: 0,
      invalid: [],
      written: false,
    });
  });
});

describe('resolveUsersFilePath', () => {
  let dbDir: string;
  beforeEach(async () => {
    dbDir = await mkdtemp(path.join(tmpdir(), 'drop-student-path-'));
  });
  afterEach(async () => {
    await rm(dbDir, { recursive: true, force: true });
  });

  test('по умолчанию — вложенный <dbDir>/users/users.json', () => {
    expect(resolveUsersFilePath(dbDir)).toBe(
      path.join(dbDir, 'users', 'users.json'),
    );
  });

  test('плоский <dbDir>/users.json — запасной, если вложенного нет', async () => {
    await writeFile(path.join(dbDir, 'users.json'), '[]');

    expect(resolveUsersFilePath(dbDir)).toBe(path.join(dbDir, 'users.json'));
  });

  test('вложенный приоритетнее плоского', async () => {
    await mkdir(path.join(dbDir, 'users'));
    await writeFile(path.join(dbDir, 'users', 'users.json'), '[]');
    await writeFile(path.join(dbDir, 'users.json'), '[]');

    expect(resolveUsersFilePath(dbDir)).toBe(
      path.join(dbDir, 'users', 'users.json'),
    );
  });
});

describe('runMigration', () => {
  let dbDir: string;
  let file: string;
  const original = [
    record(A, ['STUDENT']),
    record(B, ['MENTOR', 'STUDENT']),
    record(C, ['GUEST']),
  ];
  const originalText = JSON.stringify(original, null, 2);

  beforeEach(async () => {
    dbDir = await mkdtemp(path.join(tmpdir(), 'drop-student-run-'));
    await mkdir(path.join(dbDir, 'users'));
    file = path.join(dbDir, 'users', 'users.json');
    await writeFile(file, originalText, 'utf-8');
  });
  afterEach(async () => {
    await rm(dbDir, { recursive: true, force: true });
  });

  test('сухой прогон по умолчанию: считает, но файл не пишет', async () => {
    const result = await runMigration(dbDir);

    expect(result.total).toBe(3);
    expect(result.migrated).toBe(2);
    expect(result.becameGuest).toBe(1);
    expect(result.written).toBe(false);
    expect(await readFile(file, 'utf-8')).toBe(originalText);
  });

  test('{ write: false } — тоже сухой прогон', async () => {
    const result = await runMigration(dbDir, { write: false });

    expect(result.written).toBe(false);
    expect(await readFile(file, 'utf-8')).toBe(originalText);
  });

  test('{ write: true } пишет файл: STUDENT снят, остальное не тронуто', async () => {
    const result = await runMigration(dbDir, { write: true });

    expect(result.migrated).toBe(2);
    expect(result.written).toBe(true);
    const after = JSON.parse(await readFile(file, 'utf-8')) as Array<
      Record<string, unknown>
    >;
    expect(after).toEqual([
      record(A, ['GUEST']),
      record(B, ['MENTOR']),
      record(C, ['GUEST']),
    ]);
    expect(await readFile(file, 'utf-8')).toBe(JSON.stringify(after, null, 2));
  });

  test('повтор после записи: migrated 0, файл не переписан', async () => {
    await runMigration(dbDir, { write: true });
    const afterFirst = await readFile(file, 'utf-8');
    const mtimeFirst = (await stat(file)).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));

    const second = await runMigration(dbDir, { write: true });

    expect(second.total).toBe(3);
    expect(second.migrated).toBe(0);
    expect(second.becameGuest).toBe(0);
    expect(second.written).toBe(false);
    expect(await readFile(file, 'utf-8')).toBe(afterFirst);
    expect((await stat(file)).mtimeMs).toBe(mtimeFirst);
  });

  test('--write ничего не пишет, если менять нечего', async () => {
    const clean = JSON.stringify([record(A, ['GUEST'])], null, 2);
    await writeFile(file, clean, 'utf-8');

    const result = await runMigration(dbDir, { write: true });

    expect(result.migrated).toBe(0);
    expect(result.written).toBe(false);
    expect(await readFile(file, 'utf-8')).toBe(clean);
  });

  test('невалидная запись перечислена в invalid; при --write пишется как есть, со снятым STUDENT', async () => {
    await writeFile(
      file,
      JSON.stringify([record(A, ['STUDENT', 'OWNER'])], null, 2),
      'utf-8',
    );

    const result = await runMigration(dbDir, { write: true });

    expect(result.invalid.map((i) => i.id)).toEqual([A]);
    expect(result.written).toBe(true);
    const after = JSON.parse(await readFile(file, 'utf-8')) as Array<
      Record<string, unknown>
    >;
    expect(after).toEqual([record(A, ['OWNER'])]);
  });

  test('плоский <dbDir>/users.json обрабатывается, если вложенного нет', async () => {
    const flatDir = await mkdtemp(path.join(tmpdir(), 'drop-student-flat-'));
    try {
      const flat = path.join(flatDir, 'users.json');
      await writeFile(flat, originalText, 'utf-8');

      const result = await runMigration(flatDir, { write: true });

      expect(result.migrated).toBe(2);
      expect(result.written).toBe(true);
      expect(await readFile(flat, 'utf-8')).not.toContain('STUDENT');
    } finally {
      await rm(flatDir, { recursive: true, force: true });
    }
  });

  test('файла нет — итог с нулями, ничего не создаётся', async () => {
    const emptyDir = await mkdtemp(path.join(tmpdir(), 'drop-student-none-'));
    try {
      const result = await runMigration(emptyDir, { write: true });

      expect(result).toEqual({
        total: 0,
        migrated: 0,
        becameGuest: 0,
        invalid: [],
        written: false,
      });
      expect(await Bun.file(path.join(emptyDir, 'users')).exists()).toBe(false);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  test('не массив в файле — ошибка', async () => {
    await writeFile(file, '{}', 'utf-8');

    await expect(runMigration(dbDir)).rejects.toThrow();
  });
});
