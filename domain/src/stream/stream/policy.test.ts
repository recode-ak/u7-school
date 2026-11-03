import { describe, expect, test } from 'bun:test';
import { Status } from '@u7-scl/domain/course';
import { Role } from '@u7-scl/domain/user';
import { StreamStatus } from '../status';
import type { Stream } from './entity';
import { LegacyStreamPolicy } from './policy';

const syntaxModuleId = '33333333-3333-4333-8333-333333333333';
const algoModuleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// Моковый курс с двумя модулями в двух фазах
const mockCourse = {
  uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  title: 'Основы JS',
  description: 'Курс по основам JS',
  authorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  phases: [
    { title: 'Синтаксис', moduleIds: [syntaxModuleId] },
    { title: 'Алгоритмика', moduleIds: [algoModuleId] },
  ],
  status: Status.PUBLISHED,
  createdAt: '2026-01-01T00:00',
};

const mentorId = 'm1';

const mockStream = {
  uuid: 's1',
  schoolId: 'a0000000-0000-4000-8000-000000000001',
  title: 'Поток',
  description: 'Описание',
  mentorId,
  moduleId: 'mod1',
  startDate: '2026-06-01T12:00',
  status: StreamStatus.ACTIVE,
  createdAt: '2026-06-01T10:00',
  contentSnapshot: [],
};

describe('LegacyStreamPolicy', () => {
  test('canEnroll — true для GUEST', () => {
    const actor = {
      uuid: 'a1',
      name: 'Guest',
      telegramId: 2,
      roles: [Role.GUEST],
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(LegacyStreamPolicy.canEnroll(actor)).toBe(true);
  });

  test('canEnroll — true для MENTOR', () => {
    const actor = {
      uuid: 'a1',
      name: 'Mentor',
      telegramId: 10,
      roles: [Role.MENTOR],
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(LegacyStreamPolicy.canEnroll(actor)).toBe(true);
  });

  test('canEnroll — true для ADMIN', () => {
    const actor = {
      uuid: 'a1',
      name: 'Admin',
      telegramId: 11,
      roles: [Role.ADMIN],
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(LegacyStreamPolicy.canEnroll(actor)).toBe(true);
  });

  test('canEnroll — true для SUBSCRIBER', () => {
    const actor = {
      uuid: 'a1',
      name: 'Subscriber',
      telegramId: 12,
      roles: [Role.SUBSCRIBER],
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(LegacyStreamPolicy.canEnroll(actor)).toBe(true);
  });

  test('canEnroll — false для STUDENT', () => {
    const actor = {
      uuid: 'a1',
      name: 'Student',
      telegramId: 3,
      roles: [Role.STUDENT],
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(LegacyStreamPolicy.canEnroll(actor)).toBe(false);
  });
});

describe('LegacyStreamPolicy.canEnrollNextModule', () => {
  const mockStream = {
    uuid: 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    moduleId: syntaxModuleId,
  } as Stream;

  const mockStudentAdvanced = {
    uuid: 'b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    streamId: 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: 'c1cccccc-cccc-4ccc-8ccc-cccccccccccc',
    enrolledAt: '2026-01-01T00:00',
    status: 'advanced' as const,
    currentStepId: 'd1dddddd-dddd-4ddd-8ddd-dddddddddddd',
    steps: [],
    createdAt: '2026-01-01T00:00',
  };

  const mockStudentNotAdvanced = {
    ...mockStudentAdvanced,
    status: 'not_advanced' as const,
  };

  const mockStudentAbandoned = {
    ...mockStudentAdvanced,
    status: 'abandoned' as const,
  };

  test('входной модуль разрешён без завершённых потоков', () => {
    expect(
      LegacyStreamPolicy.canEnrollNextModule(
        mockCourse,
        syntaxModuleId,
        [],
        [],
      ),
    ).toBe(true);
  });

  test('предыдущий модуль завершён с advanced → разрешён', () => {
    expect(
      LegacyStreamPolicy.canEnrollNextModule(
        mockCourse,
        algoModuleId,
        [mockStudentAdvanced],
        [mockStream],
      ),
    ).toBe(true);
  });

  test('предыдущий модуль завершён с not_advanced → отказ', () => {
    expect(
      LegacyStreamPolicy.canEnrollNextModule(
        mockCourse,
        algoModuleId,
        [mockStudentNotAdvanced],
        [mockStream],
      ),
    ).toBe(false);
  });

  test('предыдущий модуль abandoned → отказ', () => {
    expect(
      LegacyStreamPolicy.canEnrollNextModule(
        mockCourse,
        algoModuleId,
        [mockStudentAbandoned],
        [mockStream],
      ),
    ).toBe(false);
  });

  test('нет записи на предыдущий модуль → отказ', () => {
    expect(
      LegacyStreamPolicy.canEnrollNextModule(mockCourse, algoModuleId, [], []),
    ).toBe(false);
  });

  test('модуль не найден в курсе → отказ', () => {
    expect(
      LegacyStreamPolicy.canEnrollNextModule(
        mockCourse,
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        [mockStudentAdvanced],
        [mockStream],
      ),
    ).toBe(false);
  });
});
