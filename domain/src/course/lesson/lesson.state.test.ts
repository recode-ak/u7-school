import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { LessonArDef } from './lesson.ar';
import { LESSON, MODULE, STEP_1, STEP_2, T0 } from './lesson.fixture';

// Перенос `entity.test.ts` (LessonSchema, 6) на state по Def (D-36): даты —
// числа (UTC), ISO отвергается (D-16), запись без `updatedAt` читается.

const record = {
  uuid: LESSON,
  moduleId: MODULE,
  title: 'Введение',
  additional: 'Дополнительно',
  status: 'draft',
  createdAt: T0,
  updatedAt: T0 + 60 * 60_000,
  estimatedMinutes: 45,
  stepIds: [STEP_1],
  mentorStepIds: [STEP_2],
};

// Фолбэк `updatedAt = createdAt` и `version = 0` — только в `LessonArDef.state` (D-36).
const parse = (value: unknown) => v.safeParse(LessonArDef.state, value);

describe('LessonState — даты и фолбэки (D-36)', () => {
  it('нет version → version = 0, даты как есть', () => {
    const res = parse(record);
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({
      createdAt: T0,
      updatedAt: T0 + 60 * 60_000,
      version: 0,
    });
  });

  it('ISO-строка в дате отвергается', () => {
    const iso = '2026-07-08T18:35';
    expect(parse({ ...record, createdAt: iso }).success).toBe(false);
    expect(parse({ ...record, updatedAt: iso }).success).toBe(false);
  });

  it('нет updatedAt (так в данных у 2 уроков) → updatedAt = createdAt', () => {
    const { updatedAt: _u, ...noUpdated } = record;
    const res = parse(noUpdated);
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({ createdAt: T0, updatedAt: T0 });
  });

  it('запись нового формата (числа, version) проходит как есть', () => {
    const res = parse({
      ...record,
      createdAt: T0,
      updatedAt: T0 + 1,
      version: 3,
    });
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({
      createdAt: T0,
      updatedAt: T0 + 1,
      version: 3,
    });
  });
});

describe('LessonState — поля (перенос entity.test.ts)', () => {
  it('принимает валидный урок и сохраняет поля', () => {
    const res = parse(record);
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({
      uuid: LESSON,
      moduleId: MODULE,
      title: 'Введение',
      additional: 'Дополнительно',
      status: 'draft',
      estimatedMinutes: 45,
      stepIds: [STEP_1],
      mentorStepIds: [STEP_2],
    });
  });

  it('заголовок обрезается по краям', () => {
    const res = parse({ ...record, title: '  Введение  ' });
    expect(res.output).toMatchObject({ title: 'Введение' });
  });

  it.each([
    ['пустой', ''],
    ['из пробелов (обрезка краёв)', '   '],
  ])('отклоняет заголовок %s', (_, title) => {
    expect(parse({ ...record, title }).success).toBe(false);
  });

  it('отклоняет нулевой estimatedMinutes (минимум 1)', () => {
    expect(parse({ ...record, estimatedMinutes: 0 }).success).toBe(false);
  });
});
