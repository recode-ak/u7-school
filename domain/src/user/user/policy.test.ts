import { describe, expect, test } from 'bun:test';
import { UserPolicy } from './policy';
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

describe('UserPolicy', () => {
  describe('isAuthor', () => {
    test('AUTHOR — true', () => {
      expect(UserPolicy.isAuthor(author)).toBe(true);
    });

    test('MENTOR без AUTHOR — false', () => {
      expect(UserPolicy.isAuthor(teacher)).toBe(false);
    });

    test('пользователь с AUTHOR + MENTOR — true', () => {
      const authorMentor = { ...teacher, roles: [Role.MENTOR, Role.AUTHOR] };
      expect(UserPolicy.isAuthor(authorMentor)).toBe(true);
    });
  });

  describe('canCreate', () => {
    test('ADMIN может создавать пользователей', () => {
      expect(UserPolicy.canCreate(admin)).toBe(true);
    });

    test('STUDENT не может создавать пользователей', () => {
      expect(UserPolicy.canCreate(student)).toBe(false);
    });

    test('пользователь с несколькими ролями включая ADMIN может создавать', () => {
      const userWithMultipleRoles = {
        ...student,
        roles: [Role.STUDENT, Role.ADMIN],
      };
      expect(UserPolicy.canCreate(userWithMultipleRoles)).toBe(true);
    });
  });

  describe('canAddRole', () => {
    test('ADMIN может добавить любую роль любому пользователю', () => {
      expect(UserPolicy.canAddRole(admin, student, Role.STUDENT)).toBe(true);
      expect(UserPolicy.canAddRole(admin, teacher, Role.ADMIN)).toBe(true);
      expect(UserPolicy.canAddRole(admin, guest, Role.SUBSCRIBER)).toBe(true);
    });

    test('пользователь или MENTOR НЕ может выдать роль SUBSCRIBER', () => {
      expect(UserPolicy.canAddRole(guest, guest, Role.SUBSCRIBER)).toBe(false);
      expect(UserPolicy.canAddRole(student, student, Role.SUBSCRIBER)).toBe(
        false,
      );
      expect(UserPolicy.canAddRole(teacher, guest, Role.SUBSCRIBER)).toBe(
        false,
      );
    });

    test('GUEST может добавить себе роль STUDENT', () => {
      expect(UserPolicy.canAddRole(guest, guest, Role.STUDENT)).toBe(true);
    });

    test('GUEST НЕ может добавить роль другому пользователю', () => {
      expect(UserPolicy.canAddRole(guest, student, Role.STUDENT)).toBe(false);
    });

    test('MENTOR может добавить STUDENT роль, но не другие', () => {
      expect(UserPolicy.canAddRole(teacher, student, Role.STUDENT)).toBe(true);
      expect(UserPolicy.canAddRole(teacher, teacher, Role.MENTOR)).toBe(false);
    });

    test('пользователь с ADMIN + другими ролями может всё', () => {
      const userWithAdmin = { ...student, roles: [Role.STUDENT, Role.ADMIN] };
      expect(UserPolicy.canAddRole(userWithAdmin, student, Role.MENTOR)).toBe(
        true,
      );
    });
  });

  describe('canRemoveRole', () => {
    test('ADMIN может удалить любую роль у любого пользователя', () => {
      expect(UserPolicy.canRemoveRole(admin, student, Role.STUDENT)).toBe(true);
      expect(UserPolicy.canRemoveRole(admin, teacher, Role.MENTOR)).toBe(true);
      expect(UserPolicy.canRemoveRole(admin, guest, Role.SUBSCRIBER)).toBe(
        true,
      );
    });

    test('пользователь или MENTOR НЕ может снять роль SUBSCRIBER', () => {
      expect(UserPolicy.canRemoveRole(guest, guest, Role.SUBSCRIBER)).toBe(
        false,
      );
      expect(UserPolicy.canRemoveRole(student, student, Role.SUBSCRIBER)).toBe(
        false,
      );
      expect(UserPolicy.canRemoveRole(teacher, guest, Role.SUBSCRIBER)).toBe(
        false,
      );
    });

    test('пользователь может удалить STUDENT у себя', () => {
      expect(UserPolicy.canRemoveRole(student, student, Role.STUDENT)).toBe(
        true,
      );
    });

    test('GUEST НЕ может удалить роль у другого', () => {
      expect(UserPolicy.canRemoveRole(guest, student, Role.STUDENT)).toBe(
        false,
      );
    });

    test('MENTOR может удалить STUDENT у других, но не другие роли', () => {
      expect(UserPolicy.canRemoveRole(teacher, student, Role.STUDENT)).toBe(
        true,
      );
    });
  });
});
