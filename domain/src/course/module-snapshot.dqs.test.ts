import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { ContentSnapshotVo } from './content-snapshot';
import { LessonAr } from './lesson/lesson.ar';
import { stored as storedLesson } from './lesson/lesson.fixture';
import type { LessonState } from './lesson/lesson.state';
import { ModuleAr } from './module/module.ar';
import {
  LESSON_1,
  LESSON_2,
  PROJECT_PUBLISHED,
  project,
  stored as storedModule,
} from './module/module.fixture';
import type { ModuleState } from './module/module.state';
import { ModuleSnapshotDqs } from './module-snapshot.dqs';

// Перенос двух сценариев `buildSnapshot` из прежнего доменного сервиса («исключает
// archived-проект», «исключает archived-урок опубликованного проекта») и
// сценарии по коду: порядок, пропуск висячих (долг, DOM-13), `stepIds` без
// фильтра по шагам (С1), невидимый урок пропускается, а не роняет (С2).

const LESSON_3 = '77777777-7777-4777-8777-777777777771';
const PROJECT_2 = '88888888-8888-4888-8888-888888888881';
const STEP_A = '99999999-9999-4999-8999-999999999991';
const STEP_B = '99999999-9999-4999-8999-999999999992';

const moduleAr = (
  projects: ModuleState['projects'],
  status: ModuleState['status'] = 'published',
) => ModuleAr.restore(storedModule(status, { projects }));

const lesson = (
  uuid: string,
  status: LessonState['status'] = 'published',
  extra: Partial<LessonState> = {},
) =>
  LessonAr.restore(
    storedLesson(status, {
      uuid,
      title: `Урок ${uuid.slice(0, 2)}`,
      stepIds: [STEP_A],
      ...extra,
    }),
  );

const build = (
  module: ModuleAr,
  ...lessons: LessonAr[]
): ReturnType<ModuleSnapshotDqs['build']> =>
  new ModuleSnapshotDqs(module, lessons).build();

describe('ModuleSnapshotDqs.build — перенос buildSnapshot', () => {
  it('исключает archived-проект', () => {
    const archived = {
      ...project('draft'),
      uuid: PROJECT_2,
      status: 'archived' as const,
      lessonIds: [LESSON_2],
    };
    const snapshot = build(
      moduleAr([project('published'), archived]),
      lesson(LESSON_1),
      lesson(LESSON_2),
    );

    expect(snapshot.map((p) => p.projectId)).toEqual([PROJECT_PUBLISHED]);
    expect(snapshot[0]?.lessons.map((l) => l.lessonId)).toEqual([LESSON_1]);
  });

  it('исключает archived-урок опубликованного проекта', () => {
    const snapshot = build(
      moduleAr([project('published', { lessonIds: [LESSON_1, LESSON_2] })]),
      lesson(LESSON_1),
      lesson(LESSON_2, 'archived'),
    );

    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]?.lessons.map((l) => l.lessonId)).toEqual([LESSON_1]);
  });
});

describe('ModuleSnapshotDqs.build — состав проектов', () => {
  it('проект draft не попадает в снимок', () => {
    const snapshot = build(
      moduleAr([project('published'), project('draft')]),
      lesson(LESSON_1),
    );

    expect(snapshot.map((p) => p.projectId)).toEqual([PROJECT_PUBLISHED]);
  });

  it('формат: projectId, projectTitle, lessons[{ lessonId, lessonTitle, stepIds }]', () => {
    const snapshot = build(
      moduleAr([project('published')]),
      lesson(LESSON_1, 'published', {
        title: 'Первый',
        stepIds: [STEP_A, STEP_B],
      }),
    );

    expect(snapshot).toEqual([
      {
        projectId: PROJECT_PUBLISHED,
        projectTitle: 'Проект 1',
        lessons: [
          {
            lessonId: LESSON_1,
            lessonTitle: 'Первый',
            stepIds: [STEP_A, STEP_B],
          },
        ],
      },
    ]);
  });

  it('результат проходит ContentSnapshotVo', () => {
    const snapshot = build(moduleAr([project('published')]), lesson(LESSON_1));

    expect(v.safeParse(ContentSnapshotVo, snapshot).success).toBe(true);
  });

  it('опубликованный проект без уроков остаётся с пустым lessons', () => {
    const snapshot = build(moduleAr([project('published', { lessonIds: [] })]));

    expect(snapshot).toEqual([
      { projectId: PROJECT_PUBLISHED, projectTitle: 'Проект 1', lessons: [] },
    ]);
  });

  it('статус самого модуля не фильтрует: DQS отвечает за состав, доступ проверяет UC', () => {
    const snapshot = build(
      moduleAr([project('published')], 'draft'),
      lesson(LESSON_1),
    );

    expect(snapshot).toHaveLength(1);
  });
});

describe('ModuleSnapshotDqs.build — порядок', () => {
  it('проекты — в порядке модуля', () => {
    const second = {
      ...project('published'),
      uuid: PROJECT_2,
      title: 'Проект 2',
      lessonIds: [LESSON_2],
    };
    const snapshot = build(
      moduleAr([second, project('published')]),
      lesson(LESSON_1),
      lesson(LESSON_2),
    );

    expect(snapshot.map((p) => p.projectId)).toEqual([
      PROJECT_2,
      PROJECT_PUBLISHED,
    ]);
  });

  it('уроки — в порядке lessonIds проекта, а не порядка переданных Ar', () => {
    const snapshot = build(
      moduleAr([
        project('published', { lessonIds: [LESSON_2, LESSON_3, LESSON_1] }),
      ]),
      lesson(LESSON_1),
      lesson(LESSON_3),
      lesson(LESSON_2),
    );

    expect(snapshot[0]?.lessons.map((l) => l.lessonId)).toEqual([
      LESSON_2,
      LESSON_3,
      LESSON_1,
    ]);
  });

  it('stepIds урока — в порядке урока, без перестановки', () => {
    const snapshot = build(
      moduleAr([project('published')]),
      lesson(LESSON_1, 'published', { stepIds: [STEP_B, STEP_A] }),
    );

    expect(snapshot[0]?.lessons[0]?.stepIds).toEqual([STEP_B, STEP_A]);
  });
});

describe('ModuleSnapshotDqs.build — отбор уроков', () => {
  it('draft-урок опубликованного проекта пропускается, а не ломает сборку (С2)', () => {
    const snapshot = build(
      moduleAr([project('published', { lessonIds: [LESSON_1, LESSON_2] })]),
      lesson(LESSON_1, 'draft'),
      lesson(LESSON_2),
    );

    expect(snapshot[0]?.lessons.map((l) => l.lessonId)).toEqual([LESSON_2]);
  });

  it('проект, где все уроки не опубликованы, остаётся с пустым lessons', () => {
    const snapshot = build(
      moduleAr([project('published')]),
      lesson(LESSON_1, 'draft'),
    );

    expect(snapshot).toEqual([
      { projectId: PROJECT_PUBLISHED, projectTitle: 'Проект 1', lessons: [] },
    ]);
  });

  it('lessonId проекта, которого нет среди уроков, пропускается (долг: маскирует рассогласование данных)', () => {
    const snapshot = build(
      moduleAr([
        project('published', { lessonIds: [LESSON_1, LESSON_3, LESSON_2] }),
      ]),
      lesson(LESSON_1),
      lesson(LESSON_2),
    );

    expect(snapshot[0]?.lessons.map((l) => l.lessonId)).toEqual([
      LESSON_1,
      LESSON_2,
    ]);
  });

  it('урок черновика-проекта не попадает, даже если опубликован', () => {
    const snapshot = build(
      moduleAr([
        project('published'),
        { ...project('draft'), lessonIds: [LESSON_2] },
      ]),
      lesson(LESSON_1),
      lesson(LESSON_2),
    );

    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]?.projectId).toBe(PROJECT_PUBLISHED);
    expect(snapshot.flatMap((p) => p.lessons.map((l) => l.lessonId))).toEqual([
      LESSON_1,
    ]);
  });

  it('урок в двух проектах входит в оба', () => {
    const second = {
      ...project('published'),
      uuid: PROJECT_2,
      lessonIds: [LESSON_1],
    };
    const snapshot = build(
      moduleAr([project('published'), second]),
      lesson(LESSON_1),
    );

    expect(snapshot.map((p) => p.lessons.length)).toEqual([1, 1]);
  });
});

describe('ModuleSnapshotDqs.build — stepIds (С1)', () => {
  it('stepIds урока включаются целиком: DQS не видит статусов шагов', () => {
    // В данных 32 опубликованных урока содержат по одному черновому шагу;
    // шаги DQS не получает, поэтому фильтровать нечего (поведение v0.2.6).
    const snapshot = build(
      moduleAr([project('published')]),
      lesson(LESSON_1, 'published', { stepIds: [STEP_A, STEP_B] }),
    );

    expect(snapshot[0]?.lessons[0]?.stepIds).toEqual([STEP_A, STEP_B]);
  });
});
