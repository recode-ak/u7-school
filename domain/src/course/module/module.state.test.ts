import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { ModuleArDef } from './module.ar';
import { AUTHOR, MODULE, PROJECT_PUBLISHED, T0 } from './module.fixture';
import { ProjectEntity } from './module.state';

// Перенос `entity.test.ts` (ModuleSchema, ProjectSchema) на state по Def (D-36):
// даты — числа (UTC), ISO отвергается (D-16). «НЕ содержит kind» не переносится.

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
  createdAt: T0,
  projects: [legacyProject],
};

// Фолбэк `updatedAt = createdAt` и `version = 0` — только в `ModuleArDef.state` (D-36).
const parse = (value: unknown) => v.safeParse(ModuleArDef.state, value);

describe('ModuleState — даты и фолбэки (D-36)', () => {
  it('нет updatedAt и version → updatedAt = createdAt, version = 0', () => {
    const res = parse(legacy);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.createdAt).toBe(T0);
      expect(res.output.updatedAt).toBe(T0);
      expect(res.output.version).toBe(0);
    }
  });

  it('ISO-строка в дате отвергается', () => {
    const iso = '2026-07-09T08:30';
    expect(parse({ ...legacy, createdAt: iso }).success).toBe(false);
    expect(parse({ ...legacy, updatedAt: iso }).success).toBe(false);
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

  it('принимает пустой массив projects', () => {
    expect(parse({ ...legacy, projects: [] }).success).toBe(true);
  });

  it.each([
    ['пустой', ''],
    ['из пробелов (обрезка краёв)', '   '],
  ])('отклоняет заголовок %s', (_, title) => {
    expect(parse({ ...legacy, title }).success).toBe(false);
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
      updatedAt: T0 + 1,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.tags).toEqual(['js', 'web']);
    }
  });
});

describe('ProjectEntity (перенос ProjectSchema)', () => {
  it('принимает валидный проект', () => {
    expect(v.safeParse(ProjectEntity, legacyProject).success).toBe(true);
  });

  it('принимает проект с пустым lessonIds', () => {
    expect(
      v.safeParse(ProjectEntity, { ...legacyProject, lessonIds: [] }).success,
    ).toBe(true);
  });

  it('принимает опциональные goal, result, additional', () => {
    expect(
      v.safeParse(ProjectEntity, {
        ...legacyProject,
        goal: 'Цель',
        result: 'Результат',
        additional: 'Доп',
      }).success,
    ).toBe(true);
  });

  it('отклоняет пустой заголовок проекта', () => {
    expect(
      v.safeParse(ProjectEntity, { ...legacyProject, title: '' }).success,
    ).toBe(false);
  });

  it('не имеет собственных дат (вложенная сущность)', () => {
    const res = v.safeParse(ProjectEntity, { ...legacyProject, createdAt: 1 });
    expect(res.success).toBe(true);
    if (res.success) {
      expect('createdAt' in res.output).toBe(false);
    }
  });
});
