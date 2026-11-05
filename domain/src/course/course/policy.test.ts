import { describe, expect, it } from 'bun:test';
import type { User } from '@u7-scl/domain/user';
import { Role } from '@u7-scl/domain/user';
import { Status } from '../status';
import type { Course } from './entity';
import { LegacyCoursePolicy } from './policy';

function makeUser(roles: Role[]): User {
  return {
    uuid: crypto.randomUUID(),
    telegramId: 123456789,
    name: 'Тестовый Пользователь',
    roles,
    status: 'active',
    createdAt: '2026-07-08T16:00',
  } as User;
}

function makeUserWithId(uuid: string, roles: Role[]): User {
  return {
    uuid,
    telegramId: 123456789,
    name: 'Тестовый Пользователь',
    roles,
    status: 'active',
    createdAt: '2026-07-08T16:00',
  } as User;
}

function makeCourse(authorId: string): Course {
  return {
    uuid: crypto.randomUUID(),
    title: 'Тестовый курс',
    description: 'Описание',
    authorId,
    phases: [],
    status: Status.DRAFT,
    createdAt: '2026-07-08T16:00',
  };
}

describe('LegacyCoursePolicy', () => {
  const authorId = crypto.randomUUID();
  const otherId = crypto.randomUUID();

  describe('canCreate', () => {
    it('AUTHOR может создавать', () => {
      expect(LegacyCoursePolicy.canCreate(makeUser([Role.AUTHOR]))).toBe(true);
    });

    it('ADMIN не может создавать', () => {
      expect(LegacyCoursePolicy.canCreate(makeUser([Role.ADMIN]))).toBe(false);
    });

    it('MENTOR не может создавать', () => {
      expect(LegacyCoursePolicy.canCreate(makeUser([Role.MENTOR]))).toBe(false);
    });

    it('STUDENT не может создавать', () => {
      expect(LegacyCoursePolicy.canCreate(makeUser([Role.STUDENT]))).toBe(
        false,
      );
    });
  });

  describe('canRead', () => {
    it('любой авторизованный может читать', () => {
      expect(LegacyCoursePolicy.canRead(makeUser([Role.STUDENT]))).toBe(true);
      expect(LegacyCoursePolicy.canRead(makeUser([Role.ADMIN]))).toBe(true);
    });
  });

  describe('canEdit', () => {
    it('автор может редактировать свой курс', () => {
      const course = makeCourse(authorId);
      expect(
        LegacyCoursePolicy.canEdit(
          makeUserWithId(authorId, [Role.AUTHOR]),
          course,
        ),
      ).toBe(true);
    });

    it('ADMIN может редактировать чужой курс', () => {
      const course = makeCourse(otherId);
      expect(LegacyCoursePolicy.canEdit(makeUser([Role.ADMIN]), course)).toBe(
        true,
      );
    });

    it('не-автор без ADMIN не может редактировать', () => {
      const course = makeCourse(otherId);
      expect(LegacyCoursePolicy.canEdit(makeUser([Role.MENTOR]), course)).toBe(
        false,
      );
    });
  });

  describe('canEnrollNextModule', () => {
    it('входной модуль разрешён без завершённых модулей', () => {
      const course = makeCourse(authorId);
      course.phases = [
        {
          title: 'Синтаксис',
          moduleIds: ['33333333-3333-4333-8333-333333333333'],
        },
        {
          title: 'Алгоритмика',
          moduleIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        },
      ];
      expect(
        LegacyCoursePolicy.canEnrollNextModule(
          course,
          '33333333-3333-4333-8333-333333333333',
          [],
        ),
      ).toBe(true);
    });

    it('предыдущий модуль завершён → разрешён', () => {
      const course = makeCourse(authorId);
      course.phases = [
        {
          title: 'Синтаксис',
          moduleIds: ['33333333-3333-4333-8333-333333333333'],
        },
        {
          title: 'Алгоритмика',
          moduleIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        },
      ];
      expect(
        LegacyCoursePolicy.canEnrollNextModule(
          course,
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ['33333333-3333-4333-8333-333333333333'],
        ),
      ).toBe(true);
    });

    it('предыдущий модуль не завершён → отказ', () => {
      const course = makeCourse(authorId);
      course.phases = [
        {
          title: 'Синтаксис',
          moduleIds: ['33333333-3333-4333-8333-333333333333'],
        },
        {
          title: 'Алгоритмика',
          moduleIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        },
      ];
      expect(
        LegacyCoursePolicy.canEnrollNextModule(
          course,
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          [],
        ),
      ).toBe(false);
    });

    it('завершён другой модуль, но не предыдущий → отказ', () => {
      const course = makeCourse(authorId);
      course.phases = [
        {
          title: 'Синтаксис',
          moduleIds: ['33333333-3333-4333-8333-333333333333'],
        },
        {
          title: 'Алгоритмика',
          moduleIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        },
        {
          title: 'Продвинутый',
          moduleIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        },
      ];
      expect(
        LegacyCoursePolicy.canEnrollNextModule(
          course,
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          ['33333333-3333-4333-8333-333333333333'],
        ),
      ).toBe(false);
    });

    it('модуль не найден в курсе → отказ', () => {
      const course = makeCourse(authorId);
      course.phases = [
        {
          title: 'Синтаксис',
          moduleIds: ['33333333-3333-4333-8333-333333333333'],
        },
      ];
      expect(
        LegacyCoursePolicy.canEnrollNextModule(
          course,
          'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          ['33333333-3333-4333-8333-333333333333'],
        ),
      ).toBe(false);
    });

    it('пустой курс → отказ', () => {
      const course = makeCourse(authorId);
      expect(
        LegacyCoursePolicy.canEnrollNextModule(
          course,
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          [],
        ),
      ).toBe(false);
    });
  });
});
