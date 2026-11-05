import { describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/domain/user';
import { Role } from '@u7-scl/domain/user';
import type { Module } from '../module/entity';
import { Status } from '../status';
import type { Lesson } from './entity';
import { LegacyLessonPolicy } from './policy';

function makeActor(roles: Role[], uuid = 'actor-uuid'): User {
  return {
    uuid,
    name: 'Тест',
    telegramId: 1,
    roles,
    createdAt: '2026-05-01T12:00',
  };
}

const authorId = '550e8400-e29b-41d4-a716-446655440000';

function makeModule(overrides: Partial<Module> = {}): Module {
  return {
    uuid: 'course-uuid',
    title: 'Курс',
    description: 'Описание',
    authorId,
    status: Status.DRAFT,
    createdAt: '2026-05-01T12:00',
    projects: [],
    ...overrides,
  } as Module;
}

const lesson: Lesson = {
  uuid: 'lesson-uuid',
  moduleId: 'course-uuid',
  title: 'Урок',
  status: Status.DRAFT,
  createdAt: '2026-05-01T12:00',
  stepIds: [],
  mentorStepIds: [],
};

describe('LegacyLessonPolicy', () => {
  describe('canCreate', () => {
    test('ADMIN не может создавать', () => {
      expect(LegacyLessonPolicy.canCreate(makeActor([Role.ADMIN]))).toBe(false);
    });
    test('AUTHOR может создавать', () => {
      expect(LegacyLessonPolicy.canCreate(makeActor([Role.AUTHOR]))).toBe(true);
    });
    test('MENTOR без AUTHOR не может создавать', () => {
      expect(LegacyLessonPolicy.canCreate(makeActor([Role.MENTOR]))).toBe(
        false,
      );
    });
    test('STUDENT не может создавать', () => {
      expect(LegacyLessonPolicy.canCreate(makeActor([Role.STUDENT]))).toBe(
        false,
      );
    });
  });

  describe('canRead', () => {
    const course = makeModule();

    test('автор может читать DRAFT', () => {
      expect(
        LegacyLessonPolicy.canRead(
          makeActor([Role.MENTOR], authorId),
          lesson,
          course,
        ),
      ).toBe(true);
    });

    test('ADMIN может читать DRAFT', () => {
      expect(
        LegacyLessonPolicy.canRead(
          makeActor([Role.ADMIN], 'not-author'),
          lesson,
          course,
        ),
      ).toBe(true);
    });

    test('студент (не автор) может читать PUBLISHED урок', () => {
      expect(
        LegacyLessonPolicy.canRead(
          makeActor([Role.STUDENT]),
          { ...lesson, status: Status.PUBLISHED },
          course,
        ),
      ).toBe(true);
    });

    test('студент (не автор) НЕ может читать DRAFT урок', () => {
      expect(
        LegacyLessonPolicy.canRead(makeActor([Role.STUDENT]), lesson, course),
      ).toBe(false);
    });
  });

  describe('canEdit', () => {
    const course = makeModule();

    test('автор может редактировать', () => {
      expect(
        LegacyLessonPolicy.canEdit(
          makeActor([Role.MENTOR], authorId),
          lesson,
          course,
        ),
      ).toBe(true);
    });

    test('ADMIN может редактировать', () => {
      expect(
        LegacyLessonPolicy.canEdit(makeActor([Role.ADMIN]), lesson, course),
      ).toBe(true);
    });

    test('MENTOR (не автор) не может редактировать', () => {
      expect(
        LegacyLessonPolicy.canEdit(
          makeActor([Role.MENTOR], 'other'),
          lesson,
          course,
        ),
      ).toBe(false);
    });

    test('STUDENT не может редактировать', () => {
      expect(
        LegacyLessonPolicy.canEdit(makeActor([Role.STUDENT]), lesson, course),
      ).toBe(false);
    });
  });
});
