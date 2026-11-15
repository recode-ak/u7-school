import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { CourseArDef } from './course.ar';
import {
  AUTHOR,
  COURSE,
  M1,
  M2,
  M3,
  M4,
  OUTSIDE,
  phase,
  T0,
} from './course.fixture';
import { CourseProgramInvariant, PhaseVo } from './course.state';

// Перенос `entity.test.ts` (CourseSchema — 8, PhaseSchema — 4) на state по Def
// (D-36, D-64): даты — числа (UTC), ISO отвергается (D-16); этап — метка
// `fromModuleId`, а не список модулей. Инварианты меток (Р2, Т3) — отдельная
// схема, потому что `state` с проверкой не переводится в JSON Schema.

// Фолбэк `updatedAt = createdAt` и `version = 0` — только в `CourseArDef.state`.
const parse = (value: unknown) => v.safeParse(CourseArDef.state, value);

const record = {
  uuid: COURSE,
  title: 'Полный курс JS',
  description: 'Изучаем JavaScript с нуля',
  authorId: AUTHOR,
  moduleIds: [M1, M2],
  phases: [],
  status: 'draft',
  createdAt: T0,
};

describe('CourseState — запись (перенос CourseSchema)', () => {
  it('принимает валидный курс', () => {
    expect(parse(record).success).toBe(true);
  });

  it('заголовок и описание обрезаются по краям', () => {
    const res = parse({
      ...record,
      title: '  Курс ',
      description: ' Описание ',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.title).toBe('Курс');
      expect(res.output.description).toBe('Описание');
    }
  });

  it.each([
    ['пустой заголовок', { title: '' }],
    ['заголовок из пробелов', { title: '   ' }],
    ['пустое описание', { description: '' }],
    ['некорректный createdAt', { createdAt: 'not-a-date' }],
  ])('отклоняет: %s', (_, patch) => {
    expect(parse({ ...record, ...patch }).success).toBe(false);
  });
});

describe('CourseState — прежний формат записи (старый — ошибка)', () => {
  it('этап с moduleIds и без fromModuleId — отказ', () => {
    const legacyPhase = { title: 'Основы JS', track: 'tech', moduleIds: [M1] };
    const { moduleIds: _program, ...noProgram } = record;
    expect(parse({ ...noProgram, phases: [legacyPhase] }).success).toBe(false);
    expect(parse({ ...record, phases: [legacyPhase] }).success).toBe(false);
  });
});

describe('CourseState — даты (D-36)', () => {
  it('нет updatedAt и version → updatedAt = createdAt, version = 0', () => {
    const res = parse(record);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.createdAt).toBe(T0);
      expect(res.output.updatedAt).toBe(T0);
      expect(res.output.version).toBe(0);
    }
  });

  it('ISO-строка в дате отвергается', () => {
    expect(parse({ ...record, createdAt: '2026-07-08T18:35' }).success).toBe(
      false,
    );
    expect(
      parse({ ...record, updatedAt: '2026-07-08T18:35:20Z' }).success,
    ).toBe(false);
  });

  it('запись нового формата (числа, version) проходит как есть', () => {
    const res = parse({
      ...record,
      createdAt: T0,
      updatedAt: T0 + 1,
      version: 3,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output).toMatchObject({
        createdAt: T0,
        updatedAt: T0 + 1,
        version: 3,
      });
    }
  });
});

describe('PhaseVo — метка этапа (перенос PhaseSchema)', () => {
  const valid = { title: 'Этап 1', fromModuleId: M1 };

  it.each<{ title: string; extra: { track?: string }; track?: string }>([
    { title: 'без track', extra: {}, track: undefined },
    { title: 'с track', extra: { track: 'tech' }, track: 'tech' },
  ])('принимает метку $title', ({ extra, track }) => {
    const res = v.safeParse(PhaseVo, { ...valid, ...extra });
    expect(res.success).toBe(true);
    if (res.success) expect(res.output.track).toBe(track);
  });

  it('заголовок обрезается по краям', () => {
    const res = v.safeParse(PhaseVo, { ...valid, title: ' Этап ' });
    expect(res.success).toBe(true);
    if (res.success) expect(res.output.title).toBe('Этап');
  });

  it.each([
    ['пустой заголовок', { title: '' }],
    ['заголовок из пробелов', { title: '  ' }],
  ])('отклоняет: %s', (_, patch) => {
    expect(v.safeParse(PhaseVo, { ...valid, ...patch }).success).toBe(false);
  });
});

describe('CourseProgramInvariant — инварианты программы и меток (Р2, Т3)', () => {
  const ok = (moduleIds: string[], phases: unknown[]) =>
    v.safeParse(CourseProgramInvariant, { moduleIds, phases }).success;

  it('пустая программа без этапов — валидный черновик', () => {
    expect(ok([], [])).toBe(true);
  });

  it('программа без этапов — валидный курс', () => {
    expect(ok([M1, M2], [])).toBe(true);
  });

  it('один этап с первого модуля', () => {
    expect(ok([M1, M2, M3], [phase('Основы', M1, 'tech')])).toBe(true);
  });

  it('несколько этапов: метки в 1-м и 3-м модулях программы из четырёх', () => {
    expect(
      ok([M1, M2, M3, M4], [phase('Синтаксис', M1), phase('Алгоритмика', M3)]),
    ).toBe(true);
  });

  it('метки на каждом модуле — допустимо', () => {
    expect(ok([M1, M2], [phase('Первый', M1), phase('Второй', M2)])).toBe(true);
  });

  it('пустая программа с этапами — отказ (метке не на что указать)', () => {
    expect(ok([], [phase('Этап', M1)])).toBe(false);
  });

  it('fromModuleId вне программы — отказ', () => {
    expect(ok([M1, M2], [phase('Этап', OUTSIDE)])).toBe(false);
  });

  it.each<{ title: string; phases: unknown[] }>([
    {
      title: 'метки не в порядке программы',
      phases: [phase('Второй', M3), phase('Первый', M1)],
    },
    {
      title: 'два этапа на одном модуле',
      phases: [phase('Первый', M1), phase('Второй', M1)],
    },
  ])('$title — отказ', ({ phases }) => {
    expect(ok([M1, M2, M3], phases)).toBe(false);
  });

  it('первая метка не на первом модуле — отказ', () => {
    expect(ok([M1, M2, M3], [phase('Этап', M2)])).toBe(false);
    expect(ok([M1, M2, M3], [phase('Первый', M2), phase('Второй', M3)])).toBe(
      false,
    );
  });

  it('заголовки этапов не уникальны — отказ (перенос a-root.test «дубль названий фаз»)', () => {
    expect(ok([M1, M2, M3], [phase('Этап 1', M1), phase('Этап 1', M3)])).toBe(
      false,
    );
  });

  it('повтор модуля в программе — отказ', () => {
    expect(ok([M1, M2, M1], [])).toBe(false);
    expect(ok([M1, M1], [phase('Этап', M1)])).toBe(false);
  });
});
