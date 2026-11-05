import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { CourseAr, CourseArDef, CourseView } from './course.ar';
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
import type { CourseState } from './course.state';

// Вопросы курса (Т2): этапы `stages`, место модуля `placeOf`, предыдущий модуль
// (`prevModuleId` места). Перенос `a-root.test.ts` «инварианты» (конструктор:
// дубль названий фаз → ошибка) и `getPrevModuleId` (a-root.ts:86-93). Авторские
// операции (`create`, `addPhase`, `addModuleToPhase`, `publish`) не переносятся.

const restore = (...args: Parameters<typeof stored>) =>
  CourseAr.restore(stored(...args));

/** Четыре модуля, метки в 1-м и 3-м. */
const twoStages = (extra: Partial<CourseState> = {}) =>
  restore('published', {
    moduleIds: [M1, M2, M3, M4],
    phases: [phase('Синтаксис', M1, 'tech'), phase('Алгоритмика', M3)],
    ...extra,
  });

const noStages = (moduleIds: string[]) =>
  restore('published', { moduleIds, phases: [] });

describe('CourseAr.restore — инварианты разбираются в конструкторе (Т3)', () => {
  it.each([
    [
      'дубль заголовков этапов',
      { phases: [phase('Этап', M1), phase('Этап', M3)] },
    ],
    ['метка вне программы', { phases: [phase('Этап', OUTSIDE)] }],
    [
      'метки не в порядке программы',
      { phases: [phase('Второй', M3), phase('Первый', M1)] },
    ],
    [
      'два этапа на одном модуле',
      { phases: [phase('Первый', M1), phase('Второй', M1)] },
    ],
    ['первая метка не на первом модуле', { phases: [phase('Этап', M2)] }],
    ['повтор модуля в программе', { moduleIds: [M1, M2, M1] }],
    ['этапы при пустой программе', { moduleIds: [] }],
  ])('%s — исключение ValiError', (_, extra) => {
    expect(() => restore('published', extra)).toThrow(v.ValiError);
  });

  it('курс без этапов и пустая программа черновика восстанавливаются', () => {
    expect(() => restore('draft', { moduleIds: [], phases: [] })).not.toThrow();
    expect(() => noStages([M1, M2])).not.toThrow();
  });

  it('несколько этапов с разными заголовками восстанавливаются', () => {
    expect(() => twoStages()).not.toThrow();
  });
});

describe('CourseAr.isPublished / includesModule / startModuleId', () => {
  it('published — опубликован', () => {
    expect(restore('published').isPublished()).toBe(true);
  });

  it.each(['draft', 'archived'] as const)('%s — не опубликован', (status) => {
    expect(restore(status).isPublished()).toBe(false);
  });

  it('includesModule: модуль программы — true, чужой — false', () => {
    const ar = twoStages();
    expect(ar.includesModule(M1)).toBe(true);
    expect(ar.includesModule(M4)).toBe(true);
    expect(ar.includesModule(OUTSIDE)).toBe(false);
  });

  it('includesModule не зависит от статуса', () => {
    expect(restore('archived').includesModule(M2)).toBe(true);
  });

  it('startModuleId — первый модуль программы', () => {
    expect(twoStages().startModuleId()).toBe(M1);
    expect(noStages([M3, M1]).startModuleId()).toBe(M3);
  });

  it('startModuleId пустой программы — undefined', () => {
    expect(
      restore('draft', { moduleIds: [], phases: [] }).startModuleId(),
    ).toBe(undefined);
  });
});

describe('CourseAr.enrollmentStart — стартовый модуль для записи', () => {
  it('опубликованный курс с программой — первый модуль', () => {
    expect(twoStages().enrollmentStart()).toBe(M1);
  });

  it.each(['draft', 'archived'] as const)('%s — записи нет', (status) => {
    expect(restore(status).enrollmentStart()).toBeUndefined();
  });

  it('опубликованный курс без программы — записи нет', () => {
    expect(
      restore('published', { moduleIds: [], phases: [] }).enrollmentStart(),
    ).toBeUndefined();
  });
});

describe('CourseAr.stages — этапы программы', () => {
  it('курс без этапов — []', () => {
    expect(noStages([M1, M2]).stages()).toEqual([]);
  });

  it('пустой курс — []', () => {
    expect(restore('draft', { moduleIds: [], phases: [] }).stages()).toEqual(
      [],
    );
  });

  it('один этап с первого модуля — вся программа, track сохраняется', () => {
    const ar = restore('published', {
      moduleIds: [M1, M2, M3],
      phases: [phase('Основы JS', M1, 'tech')],
    });
    expect(ar.stages()).toEqual([
      { title: 'Основы JS', track: 'tech', moduleIds: [M1, M2, M3] },
    ]);
  });

  it('несколько этапов: срез программы от метки до следующей (1-й и 3-й модули)', () => {
    expect(twoStages().stages()).toEqual([
      { title: 'Синтаксис', track: 'tech', moduleIds: [M1, M2] },
      { title: 'Алгоритмика', moduleIds: [M3, M4] },
    ]);
  });

  it('этапы по одному модулю (как у фикстурного курса fafa…)', () => {
    const ar = restore('published', {
      moduleIds: [M1, M2],
      phases: [phase('Синтаксис', M1), phase('Алгоритмика', M2)],
    });
    expect(ar.stages()).toEqual([
      { title: 'Синтаксис', moduleIds: [M1] },
      { title: 'Алгоритмика', moduleIds: [M2] },
    ]);
  });

  it('этапы вместе покрывают программу по порядку без пропусков', () => {
    const ar = restore('published', {
      moduleIds: [M1, M2, M3, M4],
      phases: [phase('A', M1), phase('B', M2), phase('C', M4)],
    });
    expect(ar.stages().flatMap((stage) => stage.moduleIds)).toEqual([
      M1,
      M2,
      M3,
      M4,
    ]);
  });

  it('stages() отдаёт копии: правка результата не меняет курс (DOM-17)', () => {
    const ar = twoStages();
    ar.stages()[0]?.moduleIds.push(OUTSIDE);
    expect(ar.stages()[0]?.moduleIds).toEqual([M1, M2]);
    expect(ar.includesModule(OUTSIDE)).toBe(false);
  });
});

describe('CourseAr.placeOf — место модуля (перенос get-module-place-uc.test)', () => {
  const three = () => noStages([M1, M2, M3]);

  it('первый модуль: isFirst, nextModuleId', () => {
    expect(three().placeOf(M1)).toEqual({
      isFirst: true,
      isLast: false,
      nextModuleId: M2,
    });
  });

  it('средний модуль: prev и next', () => {
    expect(three().placeOf(M2)).toEqual({
      isFirst: false,
      isLast: false,
      prevModuleId: M1,
      nextModuleId: M3,
    });
  });

  it('последний модуль: isLast, prevModuleId', () => {
    expect(three().placeOf(M3)).toEqual({
      isFirst: false,
      isLast: true,
      prevModuleId: M2,
    });
  });

  it('единственный модуль: и первый, и последний, соседей нет', () => {
    const place = noStages([M1]).placeOf(M1);
    expect(place).toEqual({ isFirst: true, isLast: true });
    expect(place?.prevModuleId).toBeUndefined();
    expect(place?.nextModuleId).toBeUndefined();
  });

  it('модуля нет в программе — undefined', () => {
    expect(three().placeOf(OUTSIDE)).toBeUndefined();
    expect(restore('draft', { moduleIds: [], phases: [] }).placeOf(M1)).toBe(
      undefined,
    );
  });

  it('у курса без этапов stage нет', () => {
    expect(three().placeOf(M2)?.stage).toBeUndefined();
  });

  it('один этап: stage { index 0, title, track }', () => {
    const ar = restore('published', {
      moduleIds: [M1, M2, M3],
      phases: [phase('Основы JS', M1, 'tech')],
    });
    expect(ar.placeOf(M2)).toEqual({
      isFirst: false,
      isLast: false,
      prevModuleId: M1,
      nextModuleId: M3,
      stage: { index: 0, title: 'Основы JS', track: 'tech' },
    });
  });

  it('несколько этапов: модуль второго этапа — index 1; track нет, если не задан', () => {
    expect(twoStages().placeOf(M4)).toEqual({
      isFirst: false,
      isLast: true,
      prevModuleId: M3,
      stage: { index: 1, title: 'Алгоритмика' },
    });
  });

  it('модуль первого этапа — index 0 и track этапа', () => {
    expect(twoStages().placeOf(M1)).toEqual({
      isFirst: true,
      isLast: false,
      nextModuleId: M2,
      stage: { index: 0, title: 'Синтаксис', track: 'tech' },
    });
  });

  it('предыдущий модуль берётся через границу этапов (линейный порядок, flatMap)', () => {
    // M3 — первый модуль второго этапа, его предыдущий — последний модуль первого.
    expect(twoStages().placeOf(M3)).toEqual({
      isFirst: false,
      isLast: false,
      prevModuleId: M2,
      nextModuleId: M4,
      stage: { index: 1, title: 'Алгоритмика' },
    });
  });

  it('этапы по одному модулю: место считается по линейному порядку', () => {
    const ar = restore('published', {
      moduleIds: [M1, M2],
      phases: [phase('Синтаксис', M1), phase('Алгоритмика', M2)],
    });
    expect(ar.placeOf(M2)).toEqual({
      isFirst: false,
      isLast: true,
      prevModuleId: M1,
      stage: { index: 1, title: 'Алгоритмика' },
    });
  });
});

describe('CourseAr.view — представление курса', () => {
  it('state-форма: поля курса, даты числами, version', () => {
    expect(restore('published').view()).toMatchObject({
      uuid: COURSE,
      title: 'Fullstack JS',
      description: 'Полный курс по JavaScript',
      authorId: AUTHOR,
      status: 'published',
      moduleIds: [M1, M2, M3, M4],
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  it('метки phases наружу не выходят (D-64), этапы — stages', () => {
    const view = twoStages().view();
    expect(view).not.toHaveProperty('phases');
    expect(view.stages).toEqual(twoStages().stages());
  });

  it('курс без этапов: stages = []', () => {
    expect(noStages([M1]).view().stages).toEqual([]);
  });

  it('одно и то же для любого статуса (вариант А С1: без Policy)', () => {
    for (const status of ['draft', 'published', 'archived'] as const) {
      expect(restore(status).view().status).toBe(status);
    }
  });

  it('view() валиден по CourseView и не содержит лишних полей', () => {
    const view = twoStages().view();
    expect(v.parse(CourseView, view)).toEqual(view);
    expect(Object.keys(CourseView.entries).sort()).toEqual(
      [
        'authorId',
        'createdAt',
        'description',
        'moduleIds',
        'stages',
        'status',
        'title',
        'updatedAt',
        'uuid',
        'version',
      ].sort(),
    );
  });

  it('CourseView: version обязателен, как у урока и шага', () => {
    const { version: _omitted, ...withoutVersion } = twoStages().view();
    expect(v.safeParse(CourseView, withoutVersion).success).toBe(false);
  });

  it('view() отдаёт копии moduleIds и stages (DOM-17)', () => {
    const ar = twoStages();
    const view = ar.view();
    view.moduleIds.push(OUTSIDE);
    view.stages[0]?.moduleIds.push(OUTSIDE);
    expect(ar.view().moduleIds).toEqual([M1, M2, M3, M4]);
    expect(ar.view().stages[0]?.moduleIds).toEqual([M1, M2]);
  });
});

describe('CourseArDef', () => {
  it('агрегат course с тремя статусами, без переходов и событий', () => {
    expect(CourseArDef.name).toBe('course');
    expect(Object.keys(CourseArDef.statuses ?? {})).toEqual([
      'draft',
      'published',
      'archived',
    ]);
    expect(CourseArDef.transitions).toEqual({});
  });
});
