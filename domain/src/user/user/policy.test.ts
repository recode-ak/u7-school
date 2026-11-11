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

const student = {
  uuid: 's',
  name: 'Student',
  telegramId: 2,
  roles: [Role.STUDENT],
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

    test('STUDENT не может создавать пользователей', () => {
      expect(LegacyUserPolicy.canCreate(student)).toBe(false);
    });

    test('пользователь с несколькими ролями включая ADMIN может создавать', () => {
      const userWithMultipleRoles = {
        ...student,
        roles: [Role.STUDENT, Role.ADMIN],
      };
      expect(LegacyUserPolicy.canCreate(userWithMultipleRoles)).toBe(true);
    });
  });

  describe('canAddRole', () => {
    test('ADMIN может добавить любую роль любому пользователю', () => {
      expect(LegacyUserPolicy.canAddRole(admin, student, Role.STUDENT)).toBe(
        true,
      );
      expect(LegacyUserPolicy.canAddRole(admin, teacher, Role.ADMIN)).toBe(
        true,
      );
      expect(LegacyUserPolicy.canAddRole(admin, guest, Role.SUBSCRIBER)).toBe(
        true,
      );
    });

    test('пользователь или MENTOR НЕ может выдать роль SUBSCRIBER', () => {
      expect(LegacyUserPolicy.canAddRole(guest, guest, Role.SUBSCRIBER)).toBe(
        false,
      );
      expect(
        LegacyUserPolicy.canAddRole(student, student, Role.SUBSCRIBER),
      ).toBe(false);
      expect(LegacyUserPolicy.canAddRole(teacher, guest, Role.SUBSCRIBER)).toBe(
        false,
      );
    });

    test('GUEST может добавить себе роль STUDENT', () => {
      expect(LegacyUserPolicy.canAddRole(guest, guest, Role.STUDENT)).toBe(
        true,
      );
    });

    test('GUEST НЕ может добавить роль другому пользователю', () => {
      expect(LegacyUserPolicy.canAddRole(guest, student, Role.STUDENT)).toBe(
        false,
      );
    });

    test('MENTOR может добавить STUDENT роль, но не другие', () => {
      expect(LegacyUserPolicy.canAddRole(teacher, student, Role.STUDENT)).toBe(
        true,
      );
      expect(LegacyUserPolicy.canAddRole(teacher, teacher, Role.MENTOR)).toBe(
        false,
      );
    });

    test('пользователь с ADMIN + другими ролями может всё', () => {
      const userWithAdmin = { ...student, roles: [Role.STUDENT, Role.ADMIN] };
      expect(
        LegacyUserPolicy.canAddRole(userWithAdmin, student, Role.MENTOR),
      ).toBe(true);
    });
  });

  describe('canRemoveRole', () => {
    test('ADMIN может удалить любую роль у любого пользователя', () => {
      expect(LegacyUserPolicy.canRemoveRole(admin, student, Role.STUDENT)).toBe(
        true,
      );
      expect(LegacyUserPolicy.canRemoveRole(admin, teacher, Role.MENTOR)).toBe(
        true,
      );
      expect(
        LegacyUserPolicy.canRemoveRole(admin, guest, Role.SUBSCRIBER),
      ).toBe(true);
    });

    test('пользователь или MENTOR НЕ может снять роль SUBSCRIBER', () => {
      expect(
        LegacyUserPolicy.canRemoveRole(guest, guest, Role.SUBSCRIBER),
      ).toBe(false);
      expect(
        LegacyUserPolicy.canRemoveRole(student, student, Role.SUBSCRIBER),
      ).toBe(false);
      expect(
        LegacyUserPolicy.canRemoveRole(teacher, guest, Role.SUBSCRIBER),
      ).toBe(false);
    });

    test('пользователь может удалить STUDENT у себя', () => {
      expect(
        LegacyUserPolicy.canRemoveRole(student, student, Role.STUDENT),
      ).toBe(true);
    });

    test('GUEST НЕ может удалить роль у другого', () => {
      expect(LegacyUserPolicy.canRemoveRole(guest, student, Role.STUDENT)).toBe(
        false,
      );
    });

    test('MENTOR может удалить STUDENT у других, но не другие роли', () => {
      expect(
        LegacyUserPolicy.canRemoveRole(teacher, student, Role.STUDENT),
      ).toBe(true);
    });
  });
});
