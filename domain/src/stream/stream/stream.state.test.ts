import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StreamArDef } from './stream.ar';
import { MENTOR, MODULE, SCHOOL, STREAM, snapshot } from './stream.fixture';
import { StreamState } from './stream.state';

// Перенос `entity.test.ts` (StreamSchema) на state по Def (D-36):
// даты — числа (UTC), legacy-запись с ISO читается.

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
  it('ISO-даты (без зоны — UTC) становятся числами, updatedAt = createdAt, version = 0', () => {
    const res = parse(legacy);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.startDate).toBe(Date.UTC(2026, 5, 1, 12));
      expect(res.output.createdAt).toBe(Date.UTC(2026, 5, 1, 10));
      expect(res.output.updatedAt).toBe(Date.UTC(2026, 5, 1, 10));
      expect(res.output.version).toBe(0);
    }
  });

  it('legacy updatedAt (ISO с зоной) сохраняется числом', () => {
    const res = parse({ ...legacy, updatedAt: '2026-06-02T08:30:00.000Z' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.updatedAt).toBe(Date.UTC(2026, 5, 2, 8, 30));
    }
  });

  it('запись нового формата (числа, version) проходит как есть', () => {
    const t = Date.UTC(2026, 5, 1, 10);
    const res = parse({
      ...legacy,
      startDate: Date.UTC(2026, 5, 1, 12),
      createdAt: t,
      updatedAt: t + 5,
      version: 3,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.updatedAt).toBe(t + 5);
      expect(res.output.version).toBe(3);
    }
  });

  it('снимок контента сохраняется', () => {
    const res = parse(legacy);
    expect(res.success && res.output.contentSnapshot).toEqual(snapshot);
  });
});

describe('StreamState — поля', () => {
  it('принимает все необязательные поля, включая enrollmentKey', () => {
    const res = parse({
      ...legacy,
      telegramGroupId: '-100123',
      telegramGroupInvite: 'https://t.me/+abc',
      goal: 'Цель',
      result: 'Результат',
      rules: 'Правила',
      additional: 'Допы',
      targetAudience: 'Все',
      enrollmentKey: 'секрет',
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.output.enrollmentKey).toBe('секрет');
  });

  it('без enrollmentKey ключа в результате нет', () => {
    const res = parse(legacy);
    expect(res.success && 'enrollmentKey' in res.output).toBe(false);
  });

  it('заголовок и описание обрезаются по краям', () => {
    const res = parse({ ...legacy, title: '  Поток  ', description: ' Опис ' });
    expect(res.success && [res.output.title, res.output.description]).toEqual([
      'Поток',
      'Опис',
    ]);
  });

  it.each([
    ['пустой заголовок', { title: '   ' }],
    ['пустое описание', { description: '' }],
    ['uuid не uuid', { uuid: 'x' }],
    ['schoolId не uuid', { schoolId: 'x' }],
    ['mentorId не uuid', { mentorId: 'x' }],
    ['moduleId не uuid', { moduleId: 'x' }],
    ['неизвестный статус', { status: 'paused' }],
    ['некорректная дата начала', { startDate: 'вчера' }],
    [
      'пустой заголовок проекта в снимке',
      {
        contentSnapshot: [{ ...snapshot[0], projectTitle: '' }],
      },
    ],
  ])('отклоняет: %s', (_, patch) => {
    expect(parse({ ...legacy, ...patch }).success).toBe(false);
  });

  it.each([
    'title',
    'mentorId',
    'moduleId',
    'schoolId',
    'startDate',
    'status',
    'contentSnapshot',
  ])('отклоняет запись без обязательного поля %s', (key) => {
    const { [key]: _omitted, ...rest } = legacy as Record<string, unknown>;
    expect(parse(rest).success).toBe(false);
  });

  it.each(['enrollment', 'active', 'completed', 'archived'])(
    'принимает статус %s',
    (status) => {
      expect(parse({ ...legacy, status }).success).toBe(true);
    },
  );

  it('у каждого поля есть описание (MAN-02)', () => {
    for (const field of Object.values(StreamState.entries)) {
      expect(v.getDescription(field)).toBeString();
    }
  });
});
