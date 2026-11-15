import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { TempDir } from 'dmg-core/testing';
import { DataDirAudit } from './data-dir-audit';

let tmp: TempDir;
beforeEach(() => {
  tmp = TempDir.create('data-dir-audit-');
});
afterEach(() => tmp.dispose());

/** Копия тестовых фикстур (генерат `seed:fixtures`, не в git), не живых данных. */
const copyFixtures = () => {
  for (const dir of [
    'users',
    'courses',
    'wish',
    'questionnaires',
    'peer-review',
    'streams',
  ]) {
    cpSync(`data/fixtures/${dir}`, tmp.file(dir), { recursive: true });
  }
};

describe('DataDirAudit', () => {
  test('валидная копия фикстур — 0 ошибок, по файлам число записей', async () => {
    copyFixtures();

    const report = await new DataDirAudit(tmp.path).run();

    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    const lessons = report.files.find((f) => f.file === 'courses/lessons.json');
    const expected = (
      JSON.parse(
        readFileSync(tmp.file('courses/lessons.json'), 'utf8'),
      ) as unknown[]
    ).length;
    expect(lessons).toMatchObject({ missing: false, records: expected });
  });

  test('битая запись — «файл → индекс → uuid → сообщение», ok = false', async () => {
    copyFixtures();
    const path = tmp.file('users/users.json');
    const users = JSON.parse(readFileSync(path, 'utf8')) as Array<
      Record<string, unknown>
    >;
    const broken = users[1];
    if (!broken) throw new Error('в фикстуре нет второго пользователя');
    broken.telegramId = 'не число';
    writeFileSync(path, JSON.stringify(users));

    const report = await new DataDirAudit(tmp.path).run();

    expect(report.ok).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      file: 'users/users.json',
      index: 1,
      uuid: broken.uuid,
    });
    expect(report.issues[0]?.message).toBeString();
    expect(report.issues[0]?.message.length).toBeGreaterThan(0);
  });

  test('ISO-строка в дате — ошибка записи: ловит остатки до миграции дат', async () => {
    copyFixtures();
    const path = tmp.file('users/users.json');
    const users = JSON.parse(readFileSync(path, 'utf8')) as Array<
      Record<string, unknown>
    >;
    const stale = users[0];
    if (!stale) throw new Error('в фикстуре нет пользователей');
    stale.createdAt = '2026-06-25T12:00';
    writeFileSync(path, JSON.stringify(users));

    const report = await new DataDirAudit(tmp.path).run();

    expect(report.ok).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      file: 'users/users.json',
      index: 0,
      uuid: stale.uuid,
    });
  });

  test('отсутствующий файл — missing, не ошибка', async () => {
    const report = await new DataDirAudit(tmp.path).run();

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.files.every((f) => f.missing && f.records === 0)).toBe(true);
  });

  test('не бросает на испорченном JSON: файл целиком — одна ошибка', async () => {
    copyFixtures();
    writeFileSync(tmp.file('wish/wishes.json'), '{ не json');

    const report = await new DataDirAudit(tmp.path).run();

    expect(report.ok).toBe(false);
    expect(report.issues.map((i) => i.file)).toEqual(['wish/wishes.json']);
  });

  test('ничего не пишет', async () => {
    copyFixtures();
    const before = readFileSync(tmp.file('users/users.json'), 'utf8');

    await new DataDirAudit(tmp.path).run();

    expect(readFileSync(tmp.file('users/users.json'), 'utf8')).toBe(before);
  });
});
