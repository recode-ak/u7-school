import { describe, expect, test } from 'bun:test';
import { ProjectZone } from './project-zone';

const zone = ProjectZone.default();

/** Тест-метка: UTC-момент из ISO-строки. */
const utc = (iso: string) => Date.parse(iso);

describe('ProjectZone.default — Уральск, UTC+5', () => {
  test('10:00 местного ↔ 05:00Z (ввод)', () => {
    expect(zone.parseLocal('2026-09-17T10:00')).toBe(
      utc('2026-09-17T05:00:00.000Z'),
    );
  });

  test('05:00Z ↔ 10:00 местного (вывод)', () => {
    const at = utc('2026-09-17T05:00:00.000Z');
    expect(zone.formatTime(at)).toBe('10:00');
    expect(zone.formatDate(at)).toBe('17.09.2026');
    expect(zone.formatInput(at)).toBe('2026-09-17T10:00');
  });

  test('10:00Z показывается как 15:00', () => {
    expect(zone.formatTime(utc('2026-09-17T10:00:00.000Z'))).toBe('15:00');
  });

  test('22:30Z — следующие сутки, 03:30', () => {
    const at = utc('2026-09-05T22:30:00.000Z');
    expect(zone.formatDate(at)).toBe('06.09.2026');
    expect(zone.formatTime(at)).toBe('03:30');
  });

  test('граница суток: 18:59Z — 23:59, 19:00Z — уже следующий день', () => {
    expect(zone.formatInput(utc('2026-09-05T18:59:00.000Z'))).toBe(
      '2026-09-05T23:59',
    );
    expect(zone.formatInput(utc('2026-09-05T19:00:00.000Z'))).toBe(
      '2026-09-06T00:00',
    );
  });

  test('граница суток: 23:59 местного → 18:59Z', () => {
    expect(zone.parseLocal('2026-09-05T23:59')).toBe(
      utc('2026-09-05T18:59:00.000Z'),
    );
  });

  test('граница года: 2026-12-31T20:00Z → 01.01.2027, 01:00', () => {
    const at = utc('2026-12-31T20:00:00.000Z');
    expect(zone.formatDate(at)).toBe('01.01.2027');
    expect(zone.formatTime(at)).toBe('01:00');
  });

  test('formatDate/formatTime дополняют нулями', () => {
    const at = utc('2026-01-02T00:05:00.000Z');
    expect(zone.formatDate(at)).toBe('02.01.2026');
    expect(zone.formatTime(at)).toBe('05:05');
  });
});

describe('ProjectZone.parseLocal', () => {
  test('дата без времени — полночь местного (19:00Z предыдущих суток)', () => {
    expect(zone.parseLocal('2026-09-01')).toBe(utc('2026-08-31T19:00:00.000Z'));
  });

  test('високосный день 2028-02-29 принимается', () => {
    expect(zone.parseLocal('2028-02-29')).toBe(utc('2028-02-28T19:00:00.000Z'));
  });

  for (const bad of [
    '2026-02-31',
    '2027-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-09-00',
    '2026-09-01T25:00',
    '2026-09-01T14:60',
    '2026-09-01T14:00:30',
    '2026-09-01T14:00:00.000Z',
    '2026-09-01T14:00Z',
    '2026-09-01 14:00',
    '2026-9-1',
    ' 2026-09-01',
    'завтра',
    '',
  ]) {
    test(`невалидный ввод «${bad}» → undefined`, () => {
      expect(zone.parseLocal(bad)).toBeUndefined();
    });
  }

  test('parseLocal ∘ formatInput — тождество', () => {
    const at = utc('2026-11-15T07:45:00.000Z');
    expect(zone.parseLocal(zone.formatInput(at))).toBe(at);
  });
});

describe('ProjectZone — произвольное смещение', () => {
  test('UTC+0: местное равно UTC', () => {
    const utcZone = new ProjectZone(0);
    expect(utcZone.parseLocal('2026-09-17T10:00')).toBe(
      utc('2026-09-17T10:00:00.000Z'),
    );
    expect(utcZone.formatTime(utc('2026-09-17T10:00:00.000Z'))).toBe('10:00');
  });

  test('UTC-3 (отрицательное смещение): 10:00 местного ↔ 13:00Z', () => {
    const west = new ProjectZone(-180);
    expect(west.parseLocal('2026-09-17T10:00')).toBe(
      utc('2026-09-17T13:00:00.000Z'),
    );
    expect(west.formatInput(utc('2026-09-17T02:30:00.000Z'))).toBe(
      '2026-09-16T23:30',
    );
  });

  test('default() эквивалентен new ProjectZone(300)', () => {
    const at = utc('2026-09-17T05:00:00.000Z');
    expect(zone.formatInput(at)).toBe(new ProjectZone(300).formatInput(at));
  });
});
