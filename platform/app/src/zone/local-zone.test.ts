import { describe, expect, test } from 'bun:test';
import { LocalZone } from './local-zone';

const zone = LocalZone.of('Asia/Oral');

/** Тест-метка: UTC-момент из ISO-строки. */
const utc = (iso: string) => Date.parse(iso);

describe('LocalZone Asia/Oral — Уральск, UTC+5', () => {
  test('10:00 местного ↔ 05:00Z (ввод)', () => {
    expect(zone.parseLocal('2026-09-17T10:00')).toBe(
      utc('2026-09-17T05:00:00.000Z'),
    );
  });

  test('05:00Z ↔ 10:00 местного (вывод)', () => {
    const at = utc('2026-09-17T05:00:00.000Z');
    expect(zone.formatTime(at)).toBe('10:00 (UTC+5)');
    expect(zone.formatDate(at)).toBe('17.09.2026');
    expect(zone.formatInput(at)).toBe('2026-09-17T10:00');
  });

  test('10:00Z показывается как 15:00', () => {
    expect(zone.formatTime(utc('2026-09-17T10:00:00.000Z'))).toBe(
      '15:00 (UTC+5)',
    );
  });

  test('22:30Z — следующие сутки, 03:30', () => {
    const at = utc('2026-09-05T22:30:00.000Z');
    expect(zone.formatDate(at)).toBe('06.09.2026');
    expect(zone.formatTime(at)).toBe('03:30 (UTC+5)');
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
    expect(zone.formatTime(at)).toBe('01:00 (UTC+5)');
  });

  test('formatDate/formatTime дополняют нулями', () => {
    const at = utc('2026-01-02T00:05:00.000Z');
    expect(zone.formatDate(at)).toBe('02.01.2026');
    expect(zone.formatTime(at)).toBe('05:05 (UTC+5)');
  });
});

describe('LocalZone.parseLocal', () => {
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

describe('LocalZone — другие зоны вместо произвольного смещения', () => {
  test('UTC: местное равно UTC', () => {
    const utcZone = LocalZone.of('UTC');
    expect(utcZone.parseLocal('2026-09-17T10:00')).toBe(
      utc('2026-09-17T10:00:00.000Z'),
    );
    expect(utcZone.formatTime(utc('2026-09-17T10:00:00.000Z'))).toBe(
      '10:00 (UTC)',
    );
  });

  test('America/Sao_Paulo (UTC-3, без летнего времени): 10:00 местного ↔ 13:00Z', () => {
    const west = LocalZone.of('America/Sao_Paulo');
    expect(west.parseLocal('2026-09-17T10:00')).toBe(
      utc('2026-09-17T13:00:00.000Z'),
    );
    expect(west.formatInput(utc('2026-09-17T02:30:00.000Z'))).toBe(
      '2026-09-16T23:30',
    );
  });

  test('Etc/GMT-5 форматирует так же, как Asia/Oral', () => {
    const at = utc('2026-09-17T05:00:00.000Z');
    const fixed = LocalZone.of('Etc/GMT-5');
    expect(fixed.formatInput(at)).toBe(zone.formatInput(at));
    expect(fixed.formatDate(at)).toBe(zone.formatDate(at));
    expect(fixed.formatTime(at)).toBe(zone.formatTime(at));
  });
});

describe('LocalZone Europe/Berlin — летнее время', () => {
  const berlin = LocalZone.of('Europe/Berlin');

  test('зимой (январь) UTC+1', () => {
    const at = utc('2026-01-15T11:00:00.000Z');
    expect(berlin.parseLocal('2026-01-15T12:00')).toBe(at);
    expect(berlin.formatInput(at)).toBe('2026-01-15T12:00');
    expect(berlin.offsetLabel(at)).toBe('UTC+1');
  });

  test('летом (июль) UTC+2', () => {
    const at = utc('2026-07-15T10:00:00.000Z');
    expect(berlin.parseLocal('2026-07-15T12:00')).toBe(at);
    expect(berlin.formatInput(at)).toBe('2026-07-15T12:00');
    expect(berlin.offsetLabel(at)).toBe('UTC+2');
  });

  test('несуществующее местное время (скачок вперёд) → undefined', () => {
    expect(berlin.parseLocal('2026-03-29T02:30')).toBeUndefined();
  });

  test('неоднозначное местное время (перевод назад) — ранний момент, ещё UTC+2', () => {
    expect(berlin.parseLocal('2026-10-25T02:30')).toBe(
      utc('2026-10-25T00:30:00.000Z'),
    );
  });
});

describe('LocalZone America/New_York — перевод часов назад', () => {
  test('неоднозначное 01:30 — ранний момент (EDT, UTC-4)', () => {
    expect(
      LocalZone.of('America/New_York').parseLocal('2026-11-01T01:30'),
    ).toBe(utc('2026-11-01T05:30:00.000Z'));
  });
});

describe('LocalZone — подпись смещения', () => {
  const at = utc('2026-09-17T12:00:00.000Z');

  test('Asia/Kolkata → UTC+5:30', () => {
    expect(LocalZone.of('Asia/Kolkata').offsetLabel(at)).toBe('UTC+5:30');
  });

  test('отрицательное смещение — ASCII-минус', () => {
    expect(LocalZone.of('America/Sao_Paulo').offsetLabel(at)).toBe('UTC-3');
  });

  test('UTC → UTC', () => {
    expect(LocalZone.of('UTC').offsetLabel(at)).toBe('UTC');
  });
});

describe('LocalZone.of', () => {
  test('неизвестная зона — бросает Error', () => {
    expect(() => LocalZone.of('Mars/Base')).toThrow(Error);
  });

  test('name — имя IANA', () => {
    expect(LocalZone.of('Asia/Oral').name).toBe('Asia/Oral');
  });

  test('name — выход схемы: регистр как в базе IANA', () => {
    expect(LocalZone.of('asia/oral').name).toBe('Asia/Oral');
  });
});
