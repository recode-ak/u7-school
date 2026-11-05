import { describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/domain/user';
import { Role } from '@u7-scl/domain/user';
import { Status } from '../status';
import { LegacyModulePolicy } from './policy';

function makeActor(roles: Role[], uuid = 'actor-uuid'): User {
  return {
    uuid,
    name: 'Тест',
    telegramId: 1,
    roles,
    createdAt: '2026-05-01T12:00',
  };
}

const course = {
  uuid: 'course-uuid',
  title: 'Курс',
  description: 'Описание',
  authorId: '550e8400-e29b-41d4-a716-446655440000',
  status: Status.DRAFT,
  createdAt: '2026-05-01T12:00',
  projects: [],
};

describe('LegacyModulePolicy', () => {
  describe('canCreate', () => {
    test('ADMIN не может создавать', () => {
      expect(LegacyModulePolicy.canCreate(makeActor([Role.ADMIN]))).toBe(false);
    });

    test('AUTHOR может создавать', () => {
      expect(LegacyModulePolicy.canCreate(makeActor([Role.AUTHOR]))).toBe(true);
    });

    test('MENTOR без AUTHOR не может создавать', () => {
      expect(LegacyModulePolicy.canCreate(makeActor([Role.MENTOR]))).toBe(
        false,
      );
    });

    test('пользователь с AUTHOR + MENTOR может создавать', () => {
      expect(
        LegacyModulePolicy.canCreate(makeActor([Role.MENTOR, Role.AUTHOR])),
      ).toBe(true);
    });

    test('STUDENT не может создавать', () => {
      expect(LegacyModulePolicy.canCreate(makeActor([Role.STUDENT]))).toBe(
        false,
      );
    });
  });

  describe('canRead', () => {
    test('студент может читать PUBLISHED курс', () => {
      expect(
        LegacyModulePolicy.canRead(makeActor([Role.STUDENT]), {
          ...course,
          status: Status.PUBLISHED,
        }),
      ).toBe(true);
    });

    test('студент не может читать DRAFT курс', () => {
      expect(
        LegacyModulePolicy.canRead(makeActor([Role.STUDENT]), course),
      ).toBe(false);
    });

    test('автор может читать DRAFT курс', () => {
      expect(
        LegacyModulePolicy.canRead(
          makeActor([Role.MENTOR], '550e8400-e29b-41d4-a716-446655440000'),
          course,
        ),
      ).toBe(true);
    });

    test('ADMIN может читать DRAFT курс', () => {
      expect(LegacyModulePolicy.canRead(makeActor([Role.ADMIN]), course)).toBe(
        true,
      );
    });
  });

  describe('canEdit', () => {
    test('ADMIN может редактировать чужой курс', () => {
      expect(
        LegacyModulePolicy.canEdit(
          makeActor([Role.ADMIN], 'not-author'),
          course,
        ),
      ).toBe(true);
    });

    test('автор может редактировать', () => {
      expect(
        LegacyModulePolicy.canEdit(
          makeActor([Role.MENTOR], '550e8400-e29b-41d4-a716-446655440000'),
          course,
        ),
      ).toBe(true);
    });

    test('не-автор MENTOR не может редактировать', () => {
      expect(
        LegacyModulePolicy.canEdit(
          makeActor([Role.MENTOR], 'other-uuid'),
          course,
        ),
      ).toBe(false);
    });

    test('STUDENT может редактировать свой курс', () => {
      expect(
        LegacyModulePolicy.canEdit(
          makeActor([Role.STUDENT], '550e8400-e29b-41d4-a716-446655440000'),
          course,
        ),
      ).toBe(true);
    });

    test('STUDENT не может редактировать чужой курс', () => {
      expect(
        LegacyModulePolicy.canEdit(
          makeActor([Role.STUDENT], 'other-uuid'),
          course,
        ),
      ).toBe(false);
    });

    test('AUTHOR-автор модуля может редактировать', () => {
      expect(
        LegacyModulePolicy.canEdit(
          makeActor([Role.AUTHOR], '550e8400-e29b-41d4-a716-446655440000'),
          course,
        ),
      ).toBe(true);
    });

    test('AUTHOR без авторства не может редактировать чужой модуль', () => {
      expect(
        LegacyModulePolicy.canEdit(
          makeActor([Role.AUTHOR], 'other-uuid'),
          course,
        ),
      ).toBe(false);
    });
  });

  describe('isAuthor', () => {
    test('автор — true', () => {
      expect(
        LegacyModulePolicy.isAuthor(
          makeActor([Role.STUDENT], '550e8400-e29b-41d4-a716-446655440000'),
          course,
        ),
      ).toBe(true);
    });

    test('не автор — false', () => {
      expect(
        LegacyModulePolicy.isAuthor(
          makeActor([Role.ADMIN], 'other-uuid'),
          course,
        ),
      ).toBe(false);
    });
  });

  describe('isAdminOrAuthor', () => {
    test('ADMIN — true', () => {
      expect(
        LegacyModulePolicy.isAdminOrAuthor(
          makeActor([Role.ADMIN], 'other-uuid'),
          course,
        ),
      ).toBe(true);
    });

    test('автор — true', () => {
      expect(
        LegacyModulePolicy.isAdminOrAuthor(
          makeActor([Role.STUDENT], '550e8400-e29b-41d4-a716-446655440000'),
          course,
        ),
      ).toBe(true);
    });

    test('не автор и не ADMIN — false', () => {
      expect(
        LegacyModulePolicy.isAdminOrAuthor(
          makeActor([Role.STUDENT], 'other-uuid'),
          course,
        ),
      ).toBe(false);
    });
  });

  describe('canAddProject', () => {
    test('автор может', () => {
      expect(
        LegacyModulePolicy.canAddProject(
          makeActor([Role.MENTOR], '550e8400-e29b-41d4-a716-446655440000'),
          course,
        ),
      ).toBe(true);
    });

    test('ADMIN не может (не автор)', () => {
      expect(
        LegacyModulePolicy.canAddProject(makeActor([Role.ADMIN]), course),
      ).toBe(false);
    });

    test('не автор не может', () => {
      expect(
        LegacyModulePolicy.canAddProject(
          makeActor([Role.MENTOR], 'other-uuid'),
          course,
        ),
      ).toBe(false);
    });
  });

  const module = {
    uuid: 'm-uuid',
    title: 'М',
    status: Status.DRAFT,
    createdAt: '2026-05-01T12:00',
    projects: [],
  };
  const _publishedModule = { ...module, status: Status.PUBLISHED };

  const project = {
    uuid: 'p-uuid',
    title: 'П',
    status: Status.DRAFT,
    createdAt: '2026-05-01T12:00',
    lessonIds: [],
  };
  const publishedProject = { ...project, status: Status.PUBLISHED };

  describe('canReadProject', () => {
    test('автор может читать DRAFT проект', () => {
      expect(
        LegacyModulePolicy.canReadProject(
          makeActor([Role.MENTOR], '550e8400-e29b-41d4-a716-446655440000'),
          course,
          project,
        ),
      ).toBe(true);
    });

    test('студент может читать PUBLISHED проект', () => {
      expect(
        LegacyModulePolicy.canReadProject(
          makeActor([Role.STUDENT]),
          course,
          publishedProject,
        ),
      ).toBe(true);
    });

    test('студент не может читать DRAFT проект', () => {
      expect(
        LegacyModulePolicy.canReadProject(
          makeActor([Role.STUDENT]),
          course,
          project,
        ),
      ).toBe(false);
    });
  });
});
