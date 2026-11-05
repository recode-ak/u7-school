import { describe, expect, it } from 'bun:test';
import { toJsonSchema } from 'dmg-core';
import * as v from 'valibot';
import { ModuleAr, ModuleView } from './module.ar';
import {
  AUTHOR,
  LESSON_1,
  LESSON_2,
  MODULE,
  OTHER,
  PROJECT_DRAFT,
  PROJECT_PUBLISHED,
  project,
  stored,
  T0,
} from './module.fixture';

// Перенос `get-visible-for.test.ts` (6) и «фильтрует только корневые проекты»
// из `a-root.test.ts` на `viewFor(canSeeUnpublished)`. Решение
// «видит ли черновики» принимает Policy; Ar отвечает по готовому флагу.

const restore = (...args: Parameters<typeof stored>) =>
  ModuleAr.restore(stored(...args));

describe('ModuleAr.isPublished / isAuthoredBy', () => {
  it('published — опубликован', () => {
    expect(restore('published').isPublished()).toBe(true);
  });

  it.each(['draft', 'archived'] as const)('%s — не опубликован', (status) => {
    expect(restore(status).isPublished()).toBe(false);
  });

  it('автор по authorId', () => {
    expect(restore('draft').isAuthoredBy(AUTHOR)).toBe(true);
  });

  it('чужой uuid — не автор', () => {
    expect(restore('draft').isAuthoredBy(OTHER)).toBe(false);
  });
});

describe('ModuleAr.viewFor — без права на неопубликованное (гость, студент)', () => {
  it('draft — undefined (get-visible-for: «DRAFT — null»)', () => {
    expect(restore('draft').viewFor(false)).toBeUndefined();
  });

  it('archived — undefined', () => {
    expect(restore('archived').viewFor(false)).toBeUndefined();
  });

  it('published — виден («PUBLISHED — виден»)', () => {
    const view = restore('published').viewFor(false);
    expect(view).toBeDefined();
    expect(view?.title).toBe('Основы JS');
  });

  it('published: только опубликованные проекты, черновые скрыты', () => {
    const ar = restore('published', {
      projects: [project('published'), project('draft')],
    });
    const view = ar.viewFor(false);
    expect(view?.projects.map((p) => p.uuid)).toEqual([PROJECT_PUBLISHED]);
  });

  it('published: «студент не видит DRAFT проект» — остаётся 0 проектов', () => {
    const ar = restore('published', { projects: [project('draft')] });
    expect(ar.viewFor(false)?.projects).toHaveLength(0);
  });

  it('фильтрует только корневые проекты: опубликованный остаётся, черновик нет', () => {
    const ar = restore('published', {
      projects: [project('published'), project('draft')],
    });
    const view = ar.viewFor(false);
    expect(view?.projects).toHaveLength(1);
    expect(view?.projects[0]?.title).toBe('Проект 1');
  });
});

describe('ModuleAr.viewFor — с правом на неопубликованное (автор, админ)', () => {
  it('draft виден целиком («автор видит модуль целиком»)', () => {
    const ar = restore('draft', { projects: [project('published')] });
    const view = ar.viewFor(true);
    expect(view).toBeDefined();
    expect(view?.projects).toHaveLength(1);
  });

  it('archived виден', () => {
    expect(restore('archived').viewFor(true)?.status).toBe('archived');
  });

  it('published: все проекты, включая черновые', () => {
    const ar = restore('published', {
      projects: [project('published'), project('draft')],
    });
    expect(ar.viewFor(true)?.projects.map((p) => p.uuid)).toEqual([
      PROJECT_PUBLISHED,
      PROJECT_DRAFT,
    ]);
  });

  it('представление — состояние модуля: даты числами, version', () => {
    const view = restore('published').viewFor(true);
    expect(view).toMatchObject({
      uuid: MODULE,
      authorId: AUTHOR,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });
});

describe('ModuleAr.summary', () => {
  it('uuid, title, description, status, tags — и только они', () => {
    const summary = restore('published', {
      goal: 'Цель',
      projects: [project('published')],
    }).summary();
    expect(summary).toEqual({
      uuid: MODULE,
      title: 'Основы JS',
      description: 'Изучаем синтаксис языка',
      status: 'published',
      tags: ['js', 'web'],
    });
    expect(Object.keys(summary).sort()).toEqual([
      'description',
      'status',
      'tags',
      'title',
      'uuid',
    ]);
  });

  it('без тегов — tags не задан', () => {
    expect(restore('published', { tags: undefined }).summary().tags).toBe(
      undefined,
    );
  });
});

// Вклад в снимок контента (Ф2): проекты `published` в порядке модуля,
// без уроков — их собирает `ModuleSnapshotDqs` (перенос фильтра
// `Status.PUBLISHED` из `CourseDs.buildSnapshot`).
describe('ModuleAr.publishedOutline', () => {
  it('проект published: projectId, projectTitle, lessonIds', () => {
    const ar = restore('published', {
      projects: [project('published', { lessonIds: [LESSON_1, LESSON_2] })],
    });
    expect(ar.publishedOutline()).toEqual([
      {
        projectId: PROJECT_PUBLISHED,
        projectTitle: 'Проект 1',
        lessonIds: [LESSON_1, LESSON_2],
      },
    ]);
  });

  it('только опубликованные проекты: draft и archived исключены', () => {
    const archived = {
      ...project('draft'),
      uuid: '55555555-5555-4555-8555-555555555556',
      status: 'archived' as const,
    };
    const ar = restore('published', {
      projects: [project('published'), project('draft'), archived],
    });
    expect(ar.publishedOutline().map((p) => p.projectId)).toEqual([
      PROJECT_PUBLISHED,
    ]);
  });

  it('порядок проектов модуля сохраняется', () => {
    const second = {
      ...project('published'),
      uuid: '55555555-5555-4555-8555-555555555557',
      title: 'Проект 2',
    };
    const ar = restore('published', {
      projects: [second, project('published')],
    });
    expect(ar.publishedOutline().map((p) => p.projectTitle)).toEqual([
      'Проект 2',
      'Проект 1',
    ]);
  });

  it('порядок lessonIds проекта сохраняется', () => {
    const ar = restore('published', {
      projects: [project('published', { lessonIds: [LESSON_2, LESSON_1] })],
    });
    expect(ar.publishedOutline()[0]?.lessonIds).toEqual([LESSON_2, LESSON_1]);
  });

  it('модуль без проектов — []', () => {
    expect(restore('published').publishedOutline()).toEqual([]);
  });

  it('без опубликованных проектов — []', () => {
    const ar = restore('published', { projects: [project('draft')] });
    expect(ar.publishedOutline()).toEqual([]);
  });

  it('статус самого модуля не фильтрует: draft-модуль отдаёт опубликованные проекты', () => {
    const ar = restore('draft', { projects: [project('published')] });
    expect(ar.publishedOutline()).toHaveLength(1);
  });
});

describe('ModuleView — version обязателен', () => {
  it('представление без version не проходит схему выхода', () => {
    const { version: _omitted, ...withoutVersion } = restore(
      'published',
    ).viewFor(true) as ModuleView;
    expect(v.safeParse(ModuleView, withoutVersion).success).toBe(false);
  });

  it('представление с version проходит', () => {
    const view = restore('published').viewFor(true);
    expect(v.safeParse(ModuleView, view).success).toBe(true);
  });

  it('JSON Schema выхода требует version, как у урока и шага (MAN-03)', () => {
    const schema = toJsonSchema(ModuleView) as { required?: string[] };
    expect(schema.required).toContain('version');
  });
});
