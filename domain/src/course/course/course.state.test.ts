import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
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
  stored,
  T0,
} from './course.fixture';
import { CourseProgramInvariant, PhaseVo } from './course.state';

// Перенос `entity.test.ts` (CourseSchema — 8, PhaseSchema — 4) на state по Def
// (D-36, D-64): даты — числа (UTC), legacy-запись с ISO читается; этап — метка
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
  createdAt: '2026-07-08T18:35',
};

describe('CourseState — запись (перенос CourseSchema)', () => {
  it('принимает валидный курс', () => {
    expect(parse(record).success).toBe(true);
  });

  it('принимает курс с этапом (метка с track)', () => {
    const res = parse({
      ...record,
      phases: [{ title: 'Этап 1', track: 'tech', fromModuleId: M1 }],
    });
    expect(res.success).toBe(true);
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
    ['некорректный uuid', { uuid: 'not-a-uuid' }],
    ['некорректный authorId', { authorId: 'bad-uuid' }],
    ['невалидный статус', { status: 'invalid' }],
    ['некорректный createdAt', { createdAt: 'not-a-date' }],
    ['uuid модуля в программе не uuid', { moduleIds: ['not-uuid'] }],
    ['программа не массив', { moduleIds: M1 }],
  ])('отклоняет: %s', (_, patch) => {
    expect(parse({ ...record, ...patch }).success).toBe(false);
  });

  it.each([['moduleIds'], ['phases'], ['status'], ['authorId']])(
    'отклоняет запись без обязательного поля %s',
    (key) => {
      const { [key]: _omitted, ...rest } = record as Record<string, unknown>;
      expect(parse(rest).success).toBe(false);
    },
  );

  it.each(['draft', 'published', 'archived'])(
    'статус %s допустим',
    (status) => {
      expect(parse({ ...record, status }).success).toBe(true);
    },
  );
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
  it('ISO без секунд (UTC) → число, updatedAt = createdAt, version = 0', () => {
    const res = parse(record);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.createdAt).toBe(T0);
      expect(res.output.updatedAt).toBe(T0);
      expect(res.output.version).toBe(0);
    }
  });

  it('боевые даты курса: createdAt и updatedAt без секунд', () => {
    const res = parse({
      ...record,
      createdAt: '2026-07-08T18:35',
      updatedAt: '2026-10-16T17:00',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.createdAt).toBe(Date.UTC(2026, 6, 8, 18, 35));
      expect(res.output.updatedAt).toBe(Date.UTC(2026, 9, 16, 17, 0));
    }
  });

  it('ISO с секундами и зоной читается', () => {
    const res = parse({ ...record, createdAt: '2026-07-08T18:35:20Z' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.createdAt).toBe(Date.UTC(2026, 6, 8, 18, 35, 20));
    }
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

  it('принимает метку без track', () => {
    expect(v.safeParse(PhaseVo, valid).success).toBe(true);
  });

  it('принимает метку с track', () => {
    const res = v.safeParse(PhaseVo, { ...valid, track: 'tech' });
    expect(res.success).toBe(true);
    if (res.success) expect(res.output.track).toBe('tech');
  });

  it('заголовок обрезается по краям', () => {
    const res = v.safeParse(PhaseVo, { ...valid, title: ' Этап ' });
    expect(res.success).toBe(true);
    if (res.success) expect(res.output.title).toBe('Этап');
  });

  it.each([
    ['пустой заголовок', { title: '' }],
    ['заголовок из пробелов', { title: '  ' }],
    ['fromModuleId не uuid', { fromModuleId: 'not-uuid' }],
    ['нет fromModuleId', { fromModuleId: undefined }],
    ['модули этапа вместо метки', { fromModuleId: undefined, moduleIds: [M1] }],
  ])('отклоняет: %s', (_, patch) => {
    expect(v.safeParse(PhaseVo, { ...valid, ...patch }).success).toBe(false);
  });

  it('у метки нет идентичности и дат (DOM-13)', () => {
    expect(Object.keys(PhaseVo.entries).sort()).toEqual([
      'fromModuleId',
      'title',
      'track',
    ]);
  });
});

describe('CourseArDef.state — остаётся переводимым в JSON Schema', () => {
  it('normalize(CourseArDef) не бросает (в state нет check/rawCheck, Т3)', () => {
    expect(normalize(CourseArDef)).toMatchObject({ name: 'course' });
  });

  it('инварианты программы не в state: дубль заголовков state пропускает', () => {
    const res = parse({
      ...record,
      phases: [phase('Этап', M1), phase('Этап', M2)],
    });
    expect(res.success).toBe(true);
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

  it('метки не в порядке программы — отказ', () => {
    expect(ok([M1, M2, M3], [phase('Второй', M3), phase('Первый', M1)])).toBe(
      false,
    );
  });

  it('два этапа на одном модуле — отказ', () => {
    expect(ok([M1, M2], [phase('Первый', M1), phase('Второй', M1)])).toBe(
      false,
    );
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

  it('разные заголовки этапов принимаются (перенос a-root.test)', () => {
    expect(ok([M1, M2, M3], [phase('Этап 1', M1), phase('Этап 2', M3)])).toBe(
      true,
    );
  });

  it('повтор модуля в программе — отказ', () => {
    expect(ok([M1, M2, M1], [])).toBe(false);
    expect(ok([M1, M1], [phase('Этап', M1)])).toBe(false);
  });
});

describe('stored() — построитель тестов выдаёт валидное состояние', () => {
  it('state и инвариант принимают состояние по умолчанию', () => {
    const state = stored('published');
    expect(v.safeParse(CourseArDef.state, state).success).toBe(true);
    expect(
      v.safeParse(CourseProgramInvariant, {
        moduleIds: state.moduleIds,
        phases: state.phases,
      }).success,
    ).toBe(true);
  });
});
