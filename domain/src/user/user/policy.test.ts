import { describe, expect, test } from 'bun:test';
import { LegacyUserPolicy } from './policy';
import { Role } from './roles';

const admin = {
  uuid: 'a',
  name: 'Admin',
  telegramId: 1,
  roles: [Role.ADMIN],
  createdAt: '2026-05-01T12:00',
};

const regular = {
  uuid: 's',
  name: 'Regular',
  telegramId: 2,
  roles: [Role.GUEST],
  createdAt: '2026-05-01T12:00',
};

const teacher = {
  uuid: 't',
  name: 'Teacher',
  telegramId: 3,
  roles: [Role.MENTOR],
  createdAt: '2026-05-01T12:00',
};

const author = {
  uuid: 'a2',
  name: 'Author',
  telegramId: 6,
  roles: [Role.AUTHOR],
  createdAt: '2026-05-01T12:00',
};

const guest = {
  uuid: 'g',
  name: 'Guest',
  telegramId: 5,
  roles: [Role.GUEST],
  createdAt: '2026-05-01T12:00',
};

describe('LegacyUserPolicy', () => {
  describe('isAuthor', () => {
    test('AUTHOR — true', () => {
      expect(LegacyUserPolicy.isAuthor(author)).toBe(true);
    });

    test('MENTOR без AUTHOR — false', () => {
      expect(LegacyUserPolicy.isAuthor(teacher)).toBe(false);
    });

    test('пользователь с AUTHOR + MENTOR — true', () => {
      const authorMentor = { ...teacher, roles: [Role.MENTOR, Role.AUTHOR] };
      expect(LegacyUserPolicy.isAuthor(authorMentor)).toBe(true);
    });
  });

  describe('canCreate', () => {
    test('ADMIN может создавать пользователей', () => {
      expect(LegacyUserPolicy.canCreate(admin)).toBe(true);
    });

    test('GUEST не может создавать пользователей', () => {
      expect(LegacyUserPolicy.canCreate(regular)).toBe(false);
    });

    test('пользователь с несколькими ролями включая ADMIN может создавать', () => {
      const userWithMultipleRoles = {
        ...regular,
        roles: [Role.GUEST, Role.ADMIN],
      };
      expect(LegacyUserPolicy.canCreate(userWithMultipleRoles)).toBe(true);
    });
  });

  describe('canAddRole', () => {
    test('ADMIN может добавлять роли', () => {
      expect(LegacyUserPolicy.canAddRole(admin)).toBe(true);
    });

    test('пользователь или MENTOR НЕ может выдавать роли', () => {
      expect(LegacyUserPolicy.canAddRole(guest)).toBe(false);
      expect(LegacyUserPolicy.canAddRole(regular)).toBe(false);
      expect(LegacyUserPolicy.canAddRole(teacher)).toBe(false);
    });

    test('пользователь с ADMIN + другими ролями может всё', () => {
      const userWithAdmin = { ...regular, roles: [Role.GUEST, Role.ADMIN] };
      expect(LegacyUserPolicy.canAddRole(userWithAdmin)).toBe(true);
    });
  });

  describe('canRemoveRole', () => {
    test('ADMIN может снимать роли', () => {
      expect(LegacyUserPolicy.canRemoveRole(admin)).toBe(true);
    });

    test('пользователь или MENTOR НЕ может снимать роли', () => {
      expect(LegacyUserPolicy.canRemoveRole(guest)).toBe(false);
      expect(LegacyUserPolicy.canRemoveRole(regular)).toBe(false);
      expect(LegacyUserPolicy.canRemoveRole(teacher)).toBe(false);
    });

    test('пользователь с ADMIN + другими ролями может всё', () => {
      const userWithAdmin = { ...regular, roles: [Role.GUEST, Role.ADMIN] };
      expect(LegacyUserPolicy.canRemoveRole(userWithAdmin)).toBe(true);
    });
  });
});
