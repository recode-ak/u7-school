import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { TimeZoneVo } from './time-zone';

const parse = (value: unknown) => v.safeParse(TimeZoneVo, value);

describe('TimeZoneVo — имя зоны IANA', () => {
  test.each(['Asia/Oral', 'Europe/Berlin', 'UTC', 'Etc/GMT-5'])(
    'принимает «%s»',
    (name) => {
      expect(parse(name).success).toBe(true);
    },
  );

  test.each(['Mars/Base', '+05:00', ''])('отклоняет «%s»', (name) => {
    expect(parse(name).success).toBe(false);
  });
});

test('TimeZoneVo приводит регистр к базе IANA: «asia/oral» → «Asia/Oral»', () => {
  const res = parse('asia/oral');
  expect(res.success && res.output).toBe('Asia/Oral');
});
