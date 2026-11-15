import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StreamArDef } from './stream.ar';
import { MENTOR, MODULE, SCHOOL, STREAM, snapshot } from './stream.fixture';
import type { StreamState } from './stream.state';

const record = {
  uuid: STREAM,
  schoolId: SCHOOL,
  title: 'Поток JS-1',
  description: 'Основной поток',
  mentorId: MENTOR,
  moduleId: MODULE,
  startDate: Date.UTC(2026, 5, 1, 12),
  status: 'enrollment',
  contentSnapshot: snapshot,
  createdAt: Date.UTC(2026, 5, 1, 10),
};

// Фолбэк `updatedAt = createdAt` работает только в `StreamArDef.state` (D-36).
const parse = (value: unknown) => v.safeParse(StreamArDef.state, value);

describe('StreamState — даты (D-36)', () => {
  it('ISO-строка в дате отвергается', () => {
    const iso = '2026-06-02T08:30:00.000Z';
    expect(parse({ ...record, updatedAt: iso }).success).toBe(false);
    expect(parse({ ...record, startDate: iso }).success).toBe(false);
  });
});

const optional = {
  telegramGroupId: '-100123',
  telegramGroupInvite: 'https://t.me/+abc',
  goal: 'Цель',
  result: 'Результат',
  rules: 'Правила',
  additional: 'Допы',
  targetAudience: 'Все',
};

const T = Date.UTC(2026, 5, 1, 10);

const without = (key: string) => {
  const { [key]: _omitted, ...rest } = record as Record<string, unknown>;
  return rest;
};

type Row = {
  title: string;
  value: unknown;
  valid?: boolean;
  output?: (out: StreamState) => void;
};

const REQUIRED = [
  'title',
  'mentorId',
  'moduleId',
  'schoolId',
  'startDate',
  'status',
  'contentSnapshot',
];

describe('StreamState — поля', () => {
  it('заголовок и описание обрезаются по краям', () => {
    const res = parse({ ...record, title: '  Поток  ', description: ' Опис ' });
    expect(res.success && [res.output.title, res.output.description]).toEqual([
      'Поток',
      'Опис',
    ]);
  });

  it.each<Row>([
    {
      title: 'принимает запись нового формата (числа, version)',
      value: {
        ...record,
        startDate: Date.UTC(2026, 5, 1, 12),
        createdAt: T,
        updatedAt: T + 5,
        version: 3,
      },
      valid: true,
      output: (out) => expect([out.updatedAt, out.version]).toEqual([T + 5, 3]),
    },
    {
      title: 'принимает все необязательные поля',
      value: { ...record, ...optional, enrollmentKey: 'секрет' },
      valid: true,
      output: (out) => expect(out.enrollmentKey).toBe('секрет'),
    },
    {
      title: 'принимает без enrollmentKey — ключа в результате нет',
      value: record,
      valid: true,
      output: (out) => expect('enrollmentKey' in out).toBe(false),
    },
    ...(['enrollment', 'active', 'completed', 'archived'] as const).map(
      (status) => ({
        title: `принимает статус ${status}`,
        value: { ...record, status },
        valid: true,
      }),
    ),
    { title: 'отклоняет пустой заголовок', value: { ...record, title: '   ' } },
    {
      title: 'отклоняет пустое описание',
      value: { ...record, description: '' },
    },
    { title: 'отклоняет uuid не uuid', value: { ...record, uuid: 'x' } },
    {
      title: 'отклоняет schoolId не uuid',
      value: { ...record, schoolId: 'x' },
    },
    {
      title: 'отклоняет mentorId не uuid',
      value: { ...record, mentorId: 'x' },
    },
    {
      title: 'отклоняет moduleId не uuid',
      value: { ...record, moduleId: 'x' },
    },
    {
      title: 'отклоняет неизвестный статус',
      value: { ...record, status: 'paused' },
    },
    {
      title: 'отклоняет некорректную дату начала',
      value: { ...record, startDate: 'вчера' },
    },
    {
      title: 'отклоняет пустой заголовок проекта в снимке',
      value: {
        ...record,
        contentSnapshot: [{ ...snapshot[0], projectTitle: '' }],
      },
    },
    ...REQUIRED.map((key) => ({
      title: `отклоняет запись без обязательного поля ${key}`,
      value: without(key),
    })),
  ])('$title', ({ value, valid = false, output }) => {
    const res = parse(value);
    expect(res.success).toBe(valid);
    if (res.success) output?.(res.output);
  });
});
