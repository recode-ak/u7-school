import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { LessonArDef } from './lesson.ar';
import { LESSON, MODULE, STEP_1, STEP_2, T0 } from './lesson.fixture';

// Перенос `entity.test.ts` (LessonSchema, 6) на state по Def (D-36): даты —
// числа (UTC), legacy-запись с ISO без секунд и без `updatedAt` читается.

const legacy = {
  uuid: LESSON,
  moduleId: MODULE,
  title: 'Введение',
  additional: 'Дополнительно',
  status: 'draft',
  createdAt: '2026-07-08T18:35',
  updatedAt: '2026-07-08T19:35',
  estimatedMinutes: 45,
  stepIds: [STEP_1],
  mentorStepIds: [STEP_2],
};

// Фолбэк `updatedAt = createdAt` и `version = 0` — только в `LessonArDef.state` (D-36).
const parse = (value: unknown) => v.safeParse(LessonArDef.state, value);

describe('LessonState — legacy-запись (D-36)', () => {
  it('ISO без секунд (UTC) → число, version = 0', () => {
    const res = parse(legacy);
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({
      createdAt: T0,
      updatedAt: Date.UTC(2026, 6, 8, 19, 35),
      version: 0,
    });
  });

  it('нет updatedAt (так в данных у 2 уроков) → updatedAt = createdAt', () => {
    const { updatedAt: _u, ...noUpdated } = legacy;
    const res = parse(noUpdated);
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({ createdAt: T0, updatedAt: T0 });
  });

  it('запись нового формата (числа, version) проходит как есть', () => {
    const res = parse({
      ...legacy,
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
    const res = parse(legacy);
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

  it('принимает минимальный урок без опциональных полей', () => {
    const res = parse({
      uuid: LESSON,
      moduleId: MODULE,
      title: 'Минимум',
      status: 'draft',
      createdAt: '2026-07-08T18:35',
      stepIds: [],
      mentorStepIds: [],
    });
    expect(res.success).toBe(true);
  });

  it('заголовок обрезается по краям', () => {
    const res = parse({ ...legacy, title: '  Введение  ' });
    expect(res.output).toMatchObject({ title: 'Введение' });
  });

  it('отклоняет пустой заголовок', () => {
    expect(parse({ ...legacy, title: '' }).success).toBe(false);
  });

  it('отклоняет заголовок из пробелов (обрезка краёв)', () => {
    expect(parse({ ...legacy, title: '   ' }).success).toBe(false);
  });

  it('отклоняет отрицательный estimatedMinutes', () => {
    expect(parse({ ...legacy, estimatedMinutes: -1 }).success).toBe(false);
  });

  it('отклоняет нулевой estimatedMinutes (минимум 1)', () => {
    expect(parse({ ...legacy, estimatedMinutes: 0 }).success).toBe(false);
  });

  it('отклоняет дробный estimatedMinutes', () => {
    expect(parse({ ...legacy, estimatedMinutes: 1.5 }).success).toBe(false);
  });

  it('принимает estimatedMinutes = 1', () => {
    expect(parse({ ...legacy, estimatedMinutes: 1 }).success).toBe(true);
  });

  it('отклоняет невалидный UUID в stepIds', () => {
    expect(parse({ ...legacy, stepIds: ['bad'] }).success).toBe(false);
  });

  it('отклоняет невалидный UUID в mentorStepIds', () => {
    expect(parse({ ...legacy, mentorStepIds: ['bad'] }).success).toBe(false);
  });

  it('отклоняет запись без stepIds', () => {
    const { stepIds: _s, ...noSteps } = legacy;
    expect(parse(noSteps).success).toBe(false);
  });

  it('отклоняет запись без mentorStepIds', () => {
    const { mentorStepIds: _m, ...noMentor } = legacy;
    expect(parse(noMentor).success).toBe(false);
  });

  it('отклоняет некорректный uuid урока', () => {
    expect(parse({ ...legacy, uuid: 'bad-uuid' }).success).toBe(false);
  });

  it('отклоняет некорректный moduleId', () => {
    expect(parse({ ...legacy, moduleId: 'bad' }).success).toBe(false);
  });

  it('отклоняет запись без moduleId', () => {
    const { moduleId: _m, ...noModule } = legacy;
    expect(parse(noModule).success).toBe(false);
  });

  it.each(['draft', 'published', 'archived'])(
    'статус %s допустим',
    (status) => {
      expect(parse({ ...legacy, status }).success).toBe(true);
    },
  );

  it('отклоняет неизвестный статус', () => {
    expect(parse({ ...legacy, status: 'nonsense' }).success).toBe(false);
  });
});
