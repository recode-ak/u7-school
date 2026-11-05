import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StreamArDef } from './stream.ar';
import { MENTOR, MODULE, SCHOOL, STREAM, snapshot } from './stream.fixture';
import type { StreamState } from './stream.state';

const legacy = {
  uuid: STREAM,
  schoolId: SCHOOL,
  title: 'Поток JS-1',
  description: 'Основной поток',
  mentorId: MENTOR,
  moduleId: MODULE,
  startDate: '2026-06-01T12:00',
  status: 'enrollment',
  contentSnapshot: snapshot,
  createdAt: '2026-06-01T10:00',
};

// Фолбэк `updatedAt = createdAt` работает только в `StreamArDef.state` (D-36).
const parse = (value: unknown) => v.safeParse(StreamArDef.state, value);

describe('StreamState — legacy-запись (D-36)', () => {
  it('legacy updatedAt (ISO с зоной) сохраняется числом', () => {
    const res = parse({ ...legacy, updatedAt: '2026-06-02T08:30:00.000Z' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.updatedAt).toBe(Date.UTC(2026, 5, 2, 8, 30));
    }
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
  const { [key]: _omitted, ...rest } = legacy as Record<string, unknown>;
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
    const res = parse({ ...legacy, title: '  Поток  ', description: ' Опис ' });
    expect(res.success && [res.output.title, res.output.description]).toEqual([
      'Поток',
      'Опис',
    ]);
  });

  it.each<Row>([
    {
      title: 'принимает запись нового формата (числа, version)',
      value: {
        ...legacy,
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
      value: { ...legacy, ...optional, enrollmentKey: 'секрет' },
      valid: true,
      output: (out) => expect(out.enrollmentKey).toBe('секрет'),
    },
    {
      title: 'принимает без enrollmentKey — ключа в результате нет',
      value: legacy,
      valid: true,
      output: (out) => expect('enrollmentKey' in out).toBe(false),
    },
    ...(['enrollment', 'active', 'completed', 'archived'] as const).map(
      (status) => ({
        title: `принимает статус ${status}`,
        value: { ...legacy, status },
        valid: true,
      }),
    ),
    { title: 'отклоняет пустой заголовок', value: { ...legacy, title: '   ' } },
    {
      title: 'отклоняет пустое описание',
      value: { ...legacy, description: '' },
    },
    { title: 'отклоняет uuid не uuid', value: { ...legacy, uuid: 'x' } },
    {
      title: 'отклоняет schoolId не uuid',
      value: { ...legacy, schoolId: 'x' },
    },
    {
      title: 'отклоняет mentorId не uuid',
      value: { ...legacy, mentorId: 'x' },
    },
    {
      title: 'отклоняет moduleId не uuid',
      value: { ...legacy, moduleId: 'x' },
    },
    {
      title: 'отклоняет неизвестный статус',
      value: { ...legacy, status: 'paused' },
    },
    {
      title: 'отклоняет некорректную дату начала',
      value: { ...legacy, startDate: 'вчера' },
    },
    {
      title: 'отклоняет пустой заголовок проекта в снимке',
      value: {
        ...legacy,
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
