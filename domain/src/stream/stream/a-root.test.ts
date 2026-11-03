import { describe, expect, test } from 'bun:test';
import type { ContentSnapshot } from '@u7-scl/domain/course';
import { StreamStatus } from '../status';
import { LegacyStreamAr } from './a-root';

const validContentSnapshot: ContentSnapshot = [
  {
    projectId: '11111111-1111-4111-8111-111111111111',
    projectTitle: 'Введение',
    lessons: [
      {
        lessonId: '22222222-2222-4222-8222-222222222222',
        lessonTitle: 'Урок 1',
        stepIds: [
          '33333333-3333-4333-8333-333333333333',
          '44444444-4444-4444-8444-444444444444',
        ],
      },
    ],
  },
];

/** Legacy-поток в наборе с заданным снимком контента (создание потока — `StreamAr.create`). */
const makeStream = (contentSnapshot: ContentSnapshot): LegacyStreamAr =>
  new LegacyStreamAr({
    uuid: crypto.randomUUID(),
    schoolId: 'a0000000-0000-4000-8000-000000000001',
    title: 'Поток JS-1',
    description: 'Основной поток курса JavaScript',
    mentorId: '660e8400-e29b-41d4-a716-446655440002',
    moduleId: '770e8400-e29b-41d4-a716-446655440003',
    startDate: '2026-06-01T12:00',
    status: StreamStatus.ENROLLMENT,
    contentSnapshot,
    createdAt: '2026-06-01T10:00',
  });

describe('LegacyStreamAr', () => {
  describe('findNextStep', () => {
    const complexSnapshot: ContentSnapshot = [
      {
        projectId: '11111111-1111-4111-8111-111111111111',
        projectTitle: 'Проект 1',
        lessons: [
          {
            lessonId: '11111111-1111-4222-8222-111111111111',
            lessonTitle: 'Урок 1.1',
            stepIds: [
              '11111111-1111-4333-8333-111111111111',
              '22222222-2222-4333-8333-222222222222',
            ],
          },
          {
            lessonId: '22222222-2222-4222-8222-222222222222',
            lessonTitle: 'Урок 1.2',
            stepIds: ['33333333-3333-4333-8333-333333333333'],
          },
        ],
      },
      {
        projectId: '22222222-2222-4111-8111-222222222222',
        projectTitle: 'Проект 2',
        lessons: [
          {
            lessonId: '33333333-3333-4222-8222-333333333333',
            lessonTitle: 'Урок 2.1',
            stepIds: ['44444444-4444-4444-8444-444444444444'],
          },
        ],
      },
    ];

    const s1 = '11111111-1111-4333-8333-111111111111';
    const s2 = '22222222-2222-4333-8333-222222222222';
    const s3 = '33333333-3333-4333-8333-333333333333';
    const s4 = '44444444-4444-4444-8444-444444444444';
    const sUnknown = '99999999-9999-4999-8999-999999999999';

    test('находит следующий шаг в том же уроке', () => {
      const ar = makeStream(complexSnapshot);
      expect(ar.findNextStep(s1)).toBe(s2);
    });

    test('переходит к первому шагу следующего урока в том же проекте', () => {
      const ar = makeStream(complexSnapshot);
      expect(ar.findNextStep(s2)).toBe(s3);
    });

    test('переходит к первому шагу следующего проекта', () => {
      const ar = makeStream(complexSnapshot);
      expect(ar.findNextStep(s3)).toBe(s4);
    });

    test('возвращает null на последнем шаге всего потока', () => {
      const ar = makeStream(complexSnapshot);
      expect(ar.findNextStep(s4)).toBeNull();
    });

    test('выбрасывает ошибку если stepId не найден в снимке', () => {
      const ar = makeStream(complexSnapshot);
      expect(() => ar.findNextStep(sUnknown)).toThrow(
        'Шаг не найден в структуре потока',
      );
    });
  });

  describe('findStepContext', () => {
    const snapshot: ContentSnapshot = [
      {
        projectId: '11111111-1111-4111-8111-111111111111',
        projectTitle: 'Проект 1',
        lessons: [
          {
            lessonId: '11111111-1111-4222-8222-111111111111',
            lessonTitle: 'Урок 1.1',
            stepIds: [
              '11111111-1111-4333-8333-111111111111',
              '22222222-2222-4333-8333-222222222222',
            ],
          },
          {
            lessonId: '22222222-2222-4222-8222-222222222222',
            lessonTitle: 'Урок 1.2',
            stepIds: ['33333333-3333-4333-8333-333333333333'],
          },
        ],
      },
      {
        projectId: '22222222-2222-4111-8111-222222222222',
        projectTitle: 'Проект 2',
        lessons: [
          {
            lessonId: '33333333-3333-4222-8222-333333333333',
            lessonTitle: 'Урок 2.1',
            stepIds: ['44444444-4444-4444-8444-444444444444'],
          },
        ],
      },
    ];

    const s_first = '11111111-1111-4333-8333-111111111111';
    const s_lastInLesson = '22222222-2222-4333-8333-222222222222';
    const s_lastInProject = '33333333-3333-4333-8333-333333333333';

    test('определяет шаг не последним в уроке и не последним уроке', () => {
      const ar = makeStream(snapshot);
      const ctx = ar.findStepContext(s_first);
      expect(ctx).toEqual({
        lessonId: '11111111-1111-4222-8222-111111111111',
        projectId: '11111111-1111-4111-8111-111111111111',
        isLastStepInLesson: false,
        isLastLessonInProject: false,
      });
    });

    test('определяет последний шаг урока, но не последний урок', () => {
      const ar = makeStream(snapshot);
      const ctx = ar.findStepContext(s_lastInLesson);
      expect(ctx).toEqual({
        lessonId: '11111111-1111-4222-8222-111111111111',
        projectId: '11111111-1111-4111-8111-111111111111',
        isLastStepInLesson: true,
        isLastLessonInProject: false,
      });
    });

    test('определяет последний шаг последнего урока в проекте', () => {
      const ar = makeStream(snapshot);
      const ctx = ar.findStepContext(s_lastInProject);
      expect(ctx).toEqual({
        lessonId: '22222222-2222-4222-8222-222222222222',
        projectId: '11111111-1111-4111-8111-111111111111',
        isLastStepInLesson: true,
        isLastLessonInProject: true,
      });
    });

    test('выбрасывает ошибку если шаг не найден', () => {
      const ar = makeStream(snapshot);
      expect(() =>
        ar.findStepContext('99999999-9999-4999-8999-999999999999'),
      ).toThrow('Шаг не найден в структуре потока');
    });
  });
});
