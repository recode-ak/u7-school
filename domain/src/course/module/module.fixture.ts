import type { ModuleState, ProjectVo } from './module.state';

/** Общие идентификаторы и состояние модуля для тестов домена модуля курса. */
export const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
export const AUTHOR = '660e8400-e29b-41d4-a716-446655440004';
export const OTHER = '77777777-7777-4777-8777-777777777778';
export const PROJECT_PUBLISHED = '11111111-1111-4111-8111-111111111111';
export const PROJECT_DRAFT = '22222222-2222-4222-8222-222222222222';
export const LESSON_1 = '33333333-3333-4333-8333-333333333333';
export const LESSON_2 = '44444444-4444-4444-8444-444444444444';

export const T0 = Date.UTC(2026, 6, 8, 18, 35);

export const project = (
  status: ProjectVo['status'],
  extra: Partial<ProjectVo> = {},
): ProjectVo => ({
  uuid: status === 'published' ? PROJECT_PUBLISHED : PROJECT_DRAFT,
  title: status === 'published' ? 'Проект 1' : 'Черновик',
  status,
  lessonIds: [LESSON_1],
  ...extra,
});

export const stored = (
  status: ModuleState['status'],
  extra: Partial<ModuleState> = {},
): ModuleState => ({
  uuid: MODULE,
  title: 'Основы JS',
  description: 'Изучаем синтаксис языка',
  authorId: AUTHOR,
  tags: ['js', 'web'],
  status,
  projects: [],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});
