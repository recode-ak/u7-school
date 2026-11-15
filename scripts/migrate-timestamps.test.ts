import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { DATA_FILES, JOB_RUNS_FILE } from '@u7-scl/app';
import { TempDir } from 'dmg-core/testing';
import { type MigrateIo, migrate, run } from './migrate-timestamps';

/** Момент строки без зоны или с `Z` — UTC (как прежний `F.timestamp`). */
const utc = (iso: string) => Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`);
/** Местное время потока: UTC+5. */
const local = (iso: string) => Date.parse(`${iso}:00+05:00`);

let tmp: TempDir;
beforeEach(() => {
  tmp = TempDir.create('migrate-timestamps-');
});
afterEach(() => tmp.dispose());

const put = (rel: string, text: string) => {
  const path = tmp.file(rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
const putJson = (rel: string, value: unknown) =>
  put(rel, `${JSON.stringify(value, undefined, 2)}\n`);
const text = (rel: string) => readFileSync(tmp.file(rel), 'utf8');
const json = (rel: string) => JSON.parse(text(rel)) as unknown;

function fakeIo() {
  const out: string[] = [];
  const err: string[] = [];
  const io: MigrateIo = {
    log: (l) => out.push(l),
    error: (l) => err.push(l),
  };
  return { io, out, err };
}

describe('migrate: разбор значений', () => {
  test('смешанный формат: число остаётся, ISO с зоной и без зоны становятся числом', async () => {
    putJson('users/users.json', [
      { uuid: 'a', version: 1, createdAt: 1788868800000, updatedAt: 1 },
      {
        uuid: 'b',
        version: 1,
        createdAt: '2026-06-25T12:00:00Z',
        updatedAt: 2,
      },
      { uuid: 'c', version: 1, createdAt: '2026-06-25T12:00', updatedAt: 3 },
      {
        uuid: 'd',
        version: 1,
        createdAt: '2026-06-25T17:00:00+05:00',
        updatedAt: 4,
      },
      {
        uuid: 'e',
        version: 1,
        createdAt: '2026-06-25T12:00:30.123Z',
        updatedAt: 5,
      },
    ]);

    const report = await migrate(tmp.path, { write: true });

    const users = report.files.find((f) => f.file === 'users/users.json');
    expect(users).toMatchObject({
      missing: false,
      converted: 4,
      alreadyNumber: 6,
    });
    expect(users?.invalid).toEqual([]);
    expect(json('users/users.json')).toEqual([
      { uuid: 'a', version: 1, createdAt: 1788868800000, updatedAt: 1 },
      {
        uuid: 'b',
        version: 1,
        createdAt: utc('2026-06-25T12:00:00Z'),
        updatedAt: 2,
      },
      {
        uuid: 'c',
        version: 1,
        createdAt: utc('2026-06-25T12:00'),
        updatedAt: 3,
      },
      {
        uuid: 'd',
        version: 1,
        createdAt: utc('2026-06-25T12:00'),
        updatedAt: 4,
      },
      {
        uuid: 'e',
        version: 1,
        createdAt: utc('2026-06-25T12:00:30.123Z'),
        updatedAt: 5,
      },
    ]);
  });

  test('мусор и date-only — «не разобрано» с путём записи и поля', async () => {
    putJson('users/users.json', [
      { uuid: 'a', createdAt: '2026-06-25T12:00' },
      { uuid: 'b', createdAt: 'вчера' },
      { uuid: 'c', createdAt: '2026-06-25' },
    ]);

    const report = await migrate(tmp.path, { write: false });

    const users = report.files.find((f) => f.file === 'users/users.json');
    expect(users?.converted).toBe(1);
    expect(users?.invalid).toEqual([
      { index: 1, uuid: 'b', path: 'createdAt', value: 'вчера' },
      { index: 2, uuid: 'c', path: 'createdAt', value: '2026-06-25' },
    ]);
    expect(report.totals.invalid).toBe(2);
  });

  test('невалидное значение — ничего не пишется, даже валидное в том же файле', async () => {
    putJson('users/users.json', [
      { uuid: 'a', createdAt: '2026-06-25T12:00' },
      { uuid: 'b', createdAt: 'мусор' },
    ]);
    const before = text('users/users.json');

    const report = await migrate(tmp.path, { write: true });

    expect(report.totals.invalid).toBe(1);
    expect(report.written).toEqual([]);
    expect(text('users/users.json')).toBe(before);
  });

  test('null и отсутствующие поля не трогаются и не добавляются', async () => {
    putJson('users/users.json', [
      { uuid: 'a', version: 2, createdAt: '2026-06-25T12:00' },
    ]);

    await migrate(tmp.path, { write: true });

    expect(json('users/users.json')).toEqual([
      { uuid: 'a', version: 2, createdAt: utc('2026-06-25T12:00') },
    ]);
  });
});

describe('migrate: вложенные пути', () => {
  test('questionnaire: answers[].answeredAt, completedAt null, необязательные отсутствуют', async () => {
    putJson('questionnaires/questionnaires.json', [
      {
        uuid: 'q1',
        createdAt: '2026-06-25T12:00',
        updatedAt: '2026-06-25T13:00',
        completedAt: null,
        answers: [
          { questionId: 'x', answeredAt: '2026-06-25T12:30' },
          { questionId: 'y', answeredAt: 5 },
        ],
      },
      {
        uuid: 'q2',
        createdAt: '2026-06-25T12:00',
        warnedAt: '2026-06-26T12:00',
        continueInvitedAt: '2026-06-27T12:00',
        completedAt: '2026-06-28T12:00',
        answers: [],
      },
    ]);

    const report = await migrate(tmp.path, { write: true });

    const file = report.files.find(
      (f) => f.file === 'questionnaires/questionnaires.json',
    );
    expect(file).toMatchObject({ converted: 7, alreadyNumber: 1 });
    expect(json('questionnaires/questionnaires.json')).toEqual([
      {
        uuid: 'q1',
        createdAt: utc('2026-06-25T12:00'),
        updatedAt: utc('2026-06-25T13:00'),
        completedAt: null,
        answers: [
          { questionId: 'x', answeredAt: utc('2026-06-25T12:30') },
          { questionId: 'y', answeredAt: 5 },
        ],
      },
      {
        uuid: 'q2',
        createdAt: utc('2026-06-25T12:00'),
        warnedAt: utc('2026-06-26T12:00'),
        continueInvitedAt: utc('2026-06-27T12:00'),
        completedAt: utc('2026-06-28T12:00'),
        answers: [],
      },
    ]);
  });

  test('student: steps[].issuedAt/completedAt, notices[].sentAt; notices необязателен', async () => {
    putJson('streams/students.json', [
      {
        uuid: 's1',
        createdAt: '2026-06-25T12:00',
        enrolledAt: '2026-06-25T12:00',
        steps: [
          { stepId: 'a', issuedAt: '2026-06-25T12:00' },
          {
            stepId: 'b',
            issuedAt: '2026-06-25T13:00',
            completedAt: '2026-06-25T14:00',
          },
        ],
        notices: [{ kind: 'k', sentAt: '2026-06-26T12:00' }],
      },
      {
        uuid: 's2',
        createdAt: '2026-06-25T12:00',
        enrolledAt: '2026-06-25T12:00',
        steps: [],
      },
    ]);

    const report = await migrate(tmp.path, { write: true });

    const file = report.files.find((f) => f.file === 'streams/students.json');
    expect(file?.converted).toBe(8);
    expect(json('streams/students.json')).toEqual([
      {
        uuid: 's1',
        createdAt: utc('2026-06-25T12:00'),
        enrolledAt: utc('2026-06-25T12:00'),
        steps: [
          { stepId: 'a', issuedAt: utc('2026-06-25T12:00') },
          {
            stepId: 'b',
            issuedAt: utc('2026-06-25T13:00'),
            completedAt: utc('2026-06-25T14:00'),
          },
        ],
        notices: [{ kind: 'k', sentAt: utc('2026-06-26T12:00') }],
      },
      {
        uuid: 's2',
        createdAt: utc('2026-06-25T12:00'),
        enrolledAt: utc('2026-06-25T12:00'),
        steps: [],
      },
    ]);
  });

  test('peer-review: expiresAt кампании', async () => {
    putJson('peer-review/campaigns.json', [
      {
        uuid: 'c',
        createdAt: '2026-06-25T12:00',
        expiresAt: '2026-07-25T12:00',
      },
    ]);

    await migrate(tmp.path, { write: true });

    expect(json('peer-review/campaigns.json')).toEqual([
      {
        uuid: 'c',
        createdAt: utc('2026-06-25T12:00'),
        expiresAt: utc('2026-07-25T12:00'),
      },
    ]);
  });
});

describe('migrate: startDate потока (местное UTC+5)', () => {
  const streams = [
    { uuid: 'no-zone', createdAt: 1, startDate: '2026-09-01T10:00' },
    { uuid: 'zoned-z', createdAt: 1, startDate: '2026-09-01T10:00:00Z' },
    { uuid: 'zoned-off', createdAt: 1, startDate: '2026-09-01T10:00:00+03:00' },
  ];

  test('без зоны — как +05:00, с зоной — как есть', async () => {
    putJson('streams/streams.json', streams);

    await migrate(tmp.path, { write: true });

    expect(json('streams/streams.json')).toEqual([
      { uuid: 'no-zone', createdAt: 1, startDate: local('2026-09-01T10:00') },
      { uuid: 'zoned-z', createdAt: 1, startDate: utc('2026-09-01T10:00:00Z') },
      {
        uuid: 'zoned-off',
        createdAt: 1,
        startDate: Date.parse('2026-09-01T10:00:00+03:00'),
      },
    ]);
    expect(local('2026-09-01T10:00')).toBe(
      utc('2026-09-01T10:00') - 5 * 3_600_000,
    );
  });

  test('итог: счёт «без зоны / с зоной / число» и uuid потоков без зоны', async () => {
    putJson('streams/streams.json', [...streams]);

    const report = await migrate(tmp.path, { write: false });

    expect(report.startDates).toEqual({
      withoutZone: 1,
      withZone: 2,
      numeric: 0,
      withoutZoneIds: ['no-zone'],
    });
  });

  test('число в startDate — не разобрано, запись не выполняется', async () => {
    putJson('streams/streams.json', [
      { uuid: 'n', createdAt: '2026-06-25T12:00', startDate: 1788868800000 },
    ]);
    const before = text('streams/streams.json');

    const report = await migrate(tmp.path, { write: true });

    expect(report.startDates.numeric).toBe(1);
    expect(report.totals.invalid).toBe(1);
    expect(
      report.files.find((f) => f.file === 'streams/streams.json')?.invalid,
    ).toEqual([
      { index: 0, uuid: 'n', path: 'startDate', value: 1788868800000 },
    ]);
    expect(report.written).toEqual([]);
    expect(text('streams/streams.json')).toBe(before);
  });
});

describe('migrate: jobs/last-runs.json', () => {
  test('значения lastRuns.<job> переводятся, version сохраняется', async () => {
    putJson('jobs/last-runs.json', {
      version: 1,
      lastRuns: { a: '2026-06-25T12:00', b: 5, c: '2026-06-25T12:00:00Z' },
    });

    const report = await migrate(tmp.path, { write: true });

    expect(
      report.files.find((f) => f.file === 'jobs/last-runs.json'),
    ).toMatchObject({ converted: 2, alreadyNumber: 1 });
    expect(json('jobs/last-runs.json')).toEqual({
      version: 1,
      lastRuns: {
        a: utc('2026-06-25T12:00'),
        b: 5,
        c: utc('2026-06-25T12:00:00Z'),
      },
    });
  });
});

describe('migrate: файлы', () => {
  test('отсутствующий файл — «нет файла», не ошибка', async () => {
    putJson('users/users.json', [{ uuid: 'a', createdAt: '2026-06-25T12:00' }]);

    const report = await migrate(tmp.path, { write: false });

    expect(
      report.files.find((f) => f.file === 'wish/wishes.json'),
    ).toMatchObject({
      missing: true,
      converted: 0,
      alreadyNumber: 0,
      invalid: [],
    });
    expect(report.totals.invalid).toBe(0);
  });

  test('сухой прогон ничего не пишет', async () => {
    putJson('users/users.json', [{ uuid: 'a', createdAt: '2026-06-25T12:00' }]);
    const before = text('users/users.json');

    const report = await migrate(tmp.path, { write: false });

    expect(report.totals.converted).toBe(1);
    expect(report.written).toEqual([]);
    expect(text('users/users.json')).toBe(before);
  });

  test('запись побайтовая: однострочные массивы и форматирование сохраняются, меняются только литералы дат', async () => {
    const source =
      '[{"uuid":"a","version":3,"createdAt":"2026-06-25T12:00","title":"2026-06-25T12:00"},{"uuid":"b","createdAt":"2026-06-26T12:00","updatedAt":"2026-06-27T12:00"}]';
    put('courses/lessons.json', source);

    const report = await migrate(tmp.path, { write: true });

    expect(report.written).toEqual(['courses/lessons.json']);
    expect(text('courses/lessons.json')).toBe(
      `[{"uuid":"a","version":3,"createdAt":${utc('2026-06-25T12:00')},"title":"2026-06-25T12:00"},{"uuid":"b","createdAt":${utc('2026-06-26T12:00')},"updatedAt":${utc('2026-06-27T12:00')}}]`,
    );
  });

  test('завершающий перевод строки сохраняется, его отсутствие тоже', async () => {
    put(
      'users/users.json',
      `[\n  {"uuid":"a","createdAt":"2026-06-25T12:00"}\n]\n`,
    );
    put(
      'wish/wishes.json',
      `[\n  {"uuid":"a","createdAt":"2026-06-25T12:00"}\n]`,
    );

    await migrate(tmp.path, { write: true });

    expect(text('users/users.json')).toBe(
      `[\n  {"uuid":"a","createdAt":${utc('2026-06-25T12:00')}}\n]\n`,
    );
    expect(text('wish/wishes.json')).toBe(
      `[\n  {"uuid":"a","createdAt":${utc('2026-06-25T12:00')}}\n]`,
    );
  });

  test('идемпотентность: повторный запуск — «уже число», байты равны, файлы не переписываются', async () => {
    putJson('users/users.json', [{ uuid: 'a', createdAt: '2026-06-25T12:00' }]);
    putJson('streams/streams.json', [
      {
        uuid: 's',
        createdAt: '2026-06-25T12:00',
        startDate: '2026-09-01T10:00',
      },
    ]);
    await migrate(tmp.path, { write: true });
    const users = text('users/users.json');

    const second = await migrate(tmp.path, { write: true });

    expect(second.totals.converted).toBe(0);
    // startDate после первого прогона — число: по решению брифа это invalid,
    // поэтому идемпотентность проверяется на файле без потоков.
    expect(
      second.files.find((f) => f.file === 'users/users.json'),
    ).toMatchObject({ converted: 0, alreadyNumber: 1 });
    expect(second.written).not.toContain('users/users.json');
    expect(text('users/users.json')).toBe(users);
  });

  test('всё или ничего: invalid в одном файле — не пишется ни один', async () => {
    putJson('users/users.json', [{ uuid: 'a', createdAt: '2026-06-25T12:00' }]);
    putJson('wish/wishes.json', [{ uuid: 'w', createdAt: 'мусор' }]);
    const users = text('users/users.json');
    const wishes = text('wish/wishes.json');

    const report = await migrate(tmp.path, { write: true });

    expect(report.written).toEqual([]);
    expect(text('users/users.json')).toBe(users);
    expect(text('wish/wishes.json')).toBe(wishes);
  });
});

describe('run: аргументы, коды возврата, вывод', () => {
  test('по умолчанию — сухой прогон: код 0, строка итога по файлу, файлы не изменены', async () => {
    putJson('users/users.json', [{ uuid: 'a', createdAt: '2026-06-25T12:00' }]);
    const before = text('users/users.json');
    const { io, out, err } = fakeIo();

    const code = await run([], tmp.path, io);

    expect(code).toBe(0);
    expect(err).toEqual([]);
    expect(out).toContain(
      'users/users.json: переведено 1, уже число 0, не разобрано 0',
    );
    expect(out).toContain('wish/wishes.json: нет файла');
    expect(text('users/users.json')).toBe(before);
  });

  test('сухой прогон с invalid — код 1, путь записи и поля в error', async () => {
    putJson('users/users.json', [{ uuid: 'bad-id', createdAt: 'мусор' }]);
    const { io, err } = fakeIo();

    const code = await run([], tmp.path, io);

    expect(code).toBe(1);
    const joined = err.join('\n');
    expect(joined).toContain('users/users.json');
    expect(joined).toContain('bad-id');
    expect(joined).toContain('createdAt');
  });

  test('--write: пишет, затем контрольное чтение; повторный запуск — «уже число»', async () => {
    cpSync('data/fixtures/users', tmp.file('users'), { recursive: true });
    cpSync('data/fixtures/courses', tmp.file('courses'), { recursive: true });
    const first = fakeIo();

    const code = await run(['--write'], tmp.path, first.io);

    expect(first.err).toEqual([]);
    expect(code).toBe(0);
    expect(text('users/users.json')).not.toContain('2026-06-25T12:00');
    const afterFirst = text('courses/lessons.json');
    const second = fakeIo();

    const again = await run(['--write'], tmp.path, second.io);

    expect(again).toBe(0);
    expect(second.out.join('\n')).toContain('переведено 0');
    expect(text('courses/lessons.json')).toBe(afterFirst);
  });

  test('--write с invalid — код 1, ничего не записано', async () => {
    putJson('users/users.json', [{ uuid: 'a', createdAt: '2026-06-25T12:00' }]);
    putJson('wish/wishes.json', [{ uuid: 'w', createdAt: 'мусор' }]);
    const before = text('users/users.json');
    const { io } = fakeIo();

    const code = await run(['--write'], tmp.path, io);

    expect(code).toBe(1);
    expect(text('users/users.json')).toBe(before);
  });

  test('неизвестный флаг — код 1 без чтения данных', async () => {
    const { io, err } = fakeIo();

    const code = await run(['--force'], tmp.path, io);

    expect(code).toBe(1);
    expect(err.join('\n')).toContain('--force');
  });
});

/** Разбор даты прежним `F.timestamp` dmg-core v0.3.1: без зоны — UTC. */
const oldParse = (value: string) =>
  Date.parse(/([zZ]|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`);

const migrateOne = async (value: unknown) => {
  putJson('users/users.json', [{ uuid: 'a', createdAt: value }]);
  const report = await migrate(tmp.path, { write: false });
  return report.files.find((f) => f.file === 'users/users.json');
};

describe('migrate: паритет с прежним F.timestamp (dmg-core v0.3.1)', () => {
  // Прежняя схема: isoDateTime (`YYYY-MM-DD[T ]hh:mm`, без секунд и зоны) или
  // isoTimestamp (`[T ]hh:mm:ss[.1-9 цифр]` и обязательная `Z`/`±hh[:][mm]`).
  const accepted = [
    '2026-06-25T12:00',
    '2026-06-25 12:00',
    '2026-06-25T12:00:30Z',
    '2026-06-25 12:00:30Z',
    '2026-06-25T12:00:30+05:00',
    '2026-06-25T12:00:30+0500',
    '2026-06-25T12:00:30-05:00',
    '2026-06-25T12:00:30+0530',
    '2026-06-25T12:00:30+23:59',
    '2026-06-25T12:00:30+00:00',
    '2026-06-25T12:00:30.1Z',
    '2026-06-25T12:00:30.123Z',
    '2026-06-25T12:00:30.123456789Z',
  ];
  for (const value of accepted) {
    test(`принималась — в то же число: ${value}`, async () => {
      const file = await migrateOne(value);

      expect(file?.invalid).toEqual([]);
      putJson('users/users.json', [{ uuid: 'a', createdAt: value }]);
      await migrate(tmp.path, { write: true });
      expect(json('users/users.json')).toEqual([
        { uuid: 'a', createdAt: oldParse(value) },
      ]);
    });
  }

  const rejected = [
    '2026-06-25T12:00Z', // минуты без секунд, но с зоной
    '2026-06-25T12:00+05:00',
    '2026-06-25T12:00:30', // секунды без зоны
    '2026-06-25T12:00:30.5',
    '2026-06-25T12:00:30z', // строчная z
    '2026-06-25T12:00:30,123Z', // запятая
    '2026-06-25T12:00:30.1234567890Z', // дробь длиннее 9 знаков
    '2026-06-25T12:00:30+05', // `+hh` проходила regex, но давала NaN
    '2026-06-25',
    '2026-06-25T12',
    '2026-06-25T24:00',
    '2026-06-25T12:60',
    '2026-06-25T12:00:60',
    '2026-06-25T12:00:30+24:00',
    '2026-06-25T12:00:30+05:60',
  ];
  for (const value of rejected) {
    test(`не принималась — invalid: ${value}`, async () => {
      const file = await migrateOne(value);

      expect(file?.invalid).toHaveLength(1);
      expect(file?.converted).toBe(0);
    });
  }
});

describe('migrate: краевые значения', () => {
  for (const value of [
    '2026-02-29T12:00:00Z',
    '2026-02-29T12:00',
    '2026-04-31T12:00',
    '2026-13-01T12:00',
    '2026-06-25T24:00:00Z',
    '2026-06-25T12:00:30+99:99',
  ]) {
    test(`несуществующая дата или смещение вне диапазона — invalid: ${value}`, async () => {
      const file = await migrateOne(value);

      expect(file?.invalid).toHaveLength(1);
    });
  }

  test('високосный день 2028-02-29 — принимается', async () => {
    const file = await migrateOne('2028-02-29T12:00');

    expect(file?.converted).toBe(1);
  });

  test('экранирование в соседнем поле сохраняется байт в байт, дата заменяется', async () => {
    const source =
      '[{"name":"a\\"b\\\\c\\u0041\\n","createdAt":"2026-06-25T12:00","updatedAt":5}]\n';
    put('users/users.json', source);

    await migrate(tmp.path, { write: true });

    expect(text('users/users.json')).toBe(
      source.replace(
        '"2026-06-25T12:00"',
        String(oldParse('2026-06-25T12:00')),
      ),
    );
  });

  test('ключ с экранированием (\\u0063reatedAt) распознаётся как createdAt', async () => {
    put(
      'users/users.json',
      '[{"\\u0063reatedAt":"2026-06-25T12:00","we\\"ird":"2026-06-25T12:00"}]',
    );

    await migrate(tmp.path, { write: true });

    expect(json('users/users.json')).toEqual([
      { createdAt: oldParse('2026-06-25T12:00'), 'we"ird': '2026-06-25T12:00' },
    ]);
  });

  test('значение даты с экранированием (\\u0032026-…) разбирается и заменяется', async () => {
    put('users/users.json', '[{"createdAt":"\\u0032026-06-25T12:00"}]');

    await migrate(tmp.path, { write: true });

    expect(json('users/users.json')).toEqual([
      { createdAt: oldParse('2026-06-25T12:00') },
    ]);
  });

  test('дубль ключа: ISO-строка не остаётся в файле (замена обоих или отказ)', async () => {
    const source =
      '[{"createdAt":"2026-06-25T12:00","createdAt":"2026-06-26T12:00"}]';
    put('users/users.json', source);

    const outcome = await migrate(tmp.path, { write: true }).then(
      () => 'ok',
      () => 'error',
    );

    if (outcome === 'ok') expect(text('users/users.json')).not.toContain('T12');
    else expect(text('users/users.json')).toBe(source);
  });
});

describe('run: частичная запись, права, карта путей', () => {
  test('сбой записи N-го файла: код ≠ 0, в error перечислены уже записанные', async () => {
    putJson('users/users.json', [{ uuid: 'a', createdAt: '2026-06-25T12:00' }]);
    putJson('wish/wishes.json', [{ uuid: 'w', createdAt: '2026-06-25T12:00' }]);
    chmodSync(tmp.file('wish'), 0o555);
    const { io, err } = fakeIo();

    let code: number;
    try {
      code = await run(['--write'], tmp.path, io);
    } finally {
      chmodSync(tmp.file('wish'), 0o755);
    }

    expect(code).not.toBe(0);
    const joined = err.join('\n');
    expect(joined).toContain('users/users.json');
    expect(joined).not.toContain('Ничего не записано');
    expect(json('users/users.json')).toEqual([
      { uuid: 'a', createdAt: oldParse('2026-06-25T12:00') },
    ]);
  });

  test('--write сохраняет режим файла', async () => {
    putJson('users/users.json', [{ uuid: 'a', createdAt: '2026-06-25T12:00' }]);
    chmodSync(tmp.file('users/users.json'), 0o640);
    const { io } = fakeIo();

    await run(['--write'], tmp.path, io);

    expect(statSync(tmp.file('users/users.json')).mode & 0o777).toBe(0o640);
  });

  test('карта скрипта = DATA_FILES + JOB_RUNS_FILE', async () => {
    const report = await migrate(tmp.path, { write: false });

    expect(report.files.map((f) => f.file).sort()).toEqual(
      [...Object.values(DATA_FILES), JOB_RUNS_FILE].sort(),
    );
  });
});
