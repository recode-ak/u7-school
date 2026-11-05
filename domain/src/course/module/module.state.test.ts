import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { ModuleArDef } from './module.ar';
import { AUTHOR, MODULE, PROJECT_PUBLISHED, T0 } from './module.fixture';
import { ProjectVo } from './module.state';

// Перенос `entity.test.ts` (ModuleSchema, ProjectSchema) на state по Def (D-36):
// даты — числа (UTC), legacy-запись с ISO читается. «НЕ содержит kind» не переносится.

const legacyProject = {
  uuid: PROJECT_PUBLISHED,
  title: 'Проект 1',
  status: 'published',
  lessonIds: ['770e8400-e29b-41d4-a716-446655440002'],
};

const legacy = {
  uuid: MODULE,
  title: 'Модуль по JS',
  description: 'Описание модуля',
  authorId: AUTHOR,
  status: 'draft',
  createdAt: '2026-07-08T18:35',
  projects: [legacyProject],
};

// Фолбэк `updatedAt = createdAt` и `version = 0` — только в `ModuleArDef.state` (D-36).
const parse = (value: unknown) => v.safeParse(ModuleArDef.state, value);

describe('ModuleState — legacy-запись (D-36)', () => {
  it('ISO без секунд (UTC) → число, updatedAt = createdAt, version = 0', () => {
    const res = parse(legacy);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.createdAt).toBe(T0);
      expect(res.output.updatedAt).toBe(T0);
      expect(res.output.version).toBe(0);
    }
  });

  it('legacy updatedAt (ISO без секунд) сохраняется числом', () => {
    const res = parse({ ...legacy, updatedAt: '2026-07-09T08:30' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.updatedAt).toBe(Date.UTC(2026, 6, 9, 8, 30));
    }
  });

  it('запись нового формата (числа, version) проходит как есть', () => {
    const res = parse({
      ...legacy,
      createdAt: T0,
      updatedAt: T0 + 1,
      version: 3,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.createdAt).toBe(T0);
      expect(res.output.updatedAt).toBe(T0 + 1);
      expect(res.output.version).toBe(3);
    }
  });
});

describe('ModuleState — поля (перенос entity.test.ts)', () => {
  it('принимает поля Common + projects', () => {
    expect(parse(legacy).success).toBe(true);
  });

  it('отклоняет объект без projects', () => {
    const { projects: _p, ...noProjects } = legacy;
    expect(parse(noProjects).success).toBe(false);
  });

  it('принимает пустой массив projects', () => {
    expect(parse({ ...legacy, projects: [] }).success).toBe(true);
  });

  it('отклоняет пустой заголовок', () => {
    expect(parse({ ...legacy, title: '' }).success).toBe(false);
  });

  it('отклоняет заголовок из пробелов (обрезка краёв)', () => {
    expect(parse({ ...legacy, title: '   ' }).success).toBe(false);
  });

  it('отклоняет пустое описание', () => {
    expect(parse({ ...legacy, description: '' }).success).toBe(false);
  });

  it('принимает модуль с опциональными полями', () => {
    const res = parse({
      ...legacy,
      targetAudience: 'Новички',
      goal: 'Научиться',
      result: 'Уметь',
      rules: 'Правила',
      additional: 'Доп',
      tags: ['js', 'web'],
      updatedAt: '2026-07-09T12:00',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.tags).toEqual(['js', 'web']);
    }
  });

  it('отклоняет некорректный uuid', () => {
    expect(parse({ ...legacy, uuid: 'bad-uuid' }).success).toBe(false);
  });

  it('отклоняет некорректный authorId', () => {
    expect(parse({ ...legacy, authorId: 'bad' }).success).toBe(false);
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

describe('ProjectVo (перенос ProjectSchema)', () => {
  it('принимает валидный проект', () => {
    expect(v.safeParse(ProjectVo, legacyProject).success).toBe(true);
  });

  it('принимает проект с пустым lessonIds', () => {
    expect(
      v.safeParse(ProjectVo, { ...legacyProject, lessonIds: [] }).success,
    ).toBe(true);
  });

  it('принимает опциональные goal, result, additional', () => {
    expect(
      v.safeParse(ProjectVo, {
        ...legacyProject,
        goal: 'Цель',
        result: 'Результат',
        additional: 'Доп',
      }).success,
    ).toBe(true);
  });

  it('отклоняет пустой заголовок проекта', () => {
    expect(
      v.safeParse(ProjectVo, { ...legacyProject, title: '' }).success,
    ).toBe(false);
  });

  it('отклоняет некорректный uuid урока в lessonIds', () => {
    expect(
      v.safeParse(ProjectVo, { ...legacyProject, lessonIds: ['x'] }).success,
    ).toBe(false);
  });

  it('не имеет собственных дат (value object)', () => {
    const res = v.safeParse(ProjectVo, { ...legacyProject, createdAt: 1 });
    if (res.success) {
      expect('createdAt' in res.output).toBe(false);
    }
  });
});
