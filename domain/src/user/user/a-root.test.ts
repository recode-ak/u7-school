import { describe, expect, test } from 'bun:test';
import { UserAr } from './a-root';
import { Role } from './roles';

const validUser = {
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Иван',
  telegramId: 123,
  roles: [Role.ADMIN],
  createdAt: '2026-05-01T12:00',
};

describe('UserAr', () => {
  describe('constructor', () => {
    test('создаётся из существующего состояния', () => {
      const ar = new UserAr(validUser);
      expect(ar.state).toEqual(validUser);
    });

    test('нарушение инвариантов выбрасывает ошибку', () => {
      const invalidInputs = [
        { name: '' },
        { uuid: 'bad' },
        { telegramId: -5 },
        { roles: [] as Role[] },
        { uuid: 'bad', name: '', telegramId: -5, roles: [] as Role[] },
      ];
      for (const invalidInput of invalidInputs) {
        expect(() => new UserAr({ ...validUser, ...invalidInput })).toThrow(
          'Нарушены инварианты агрегата',
        );
      }
    });
  });

  describe('create', () => {
    test('генерирует UUID и createdAt', () => {
      const ar = UserAr.create({
        name: 'А',
        telegramId: 1,
        roles: [Role.STUDENT],
      });
      expect(ar.state.uuid).toBeString();
      expect(ar.state.uuid).toMatch(
        /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      );
      expect(ar.state.createdAt).toBeString();
      expect(ar.state.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    test('сохраняет переданные поля', () => {
      const ar = UserAr.create({
        name: 'Петр',
        telegramId: 456,
        roles: [Role.MENTOR, Role.ADMIN],
      });
      expect(ar.state.name).toBe('Петр');
      expect(ar.state.telegramId).toBe(456);
      expect(ar.state.roles).toEqual([Role.MENTOR, Role.ADMIN]);
    });
  });

  describe('register', () => {
    test('создаёт пользователя с ролью GUEST', () => {
      const ar = UserAr.register({
        name: 'Анна',
        telegramId: 789,
      });
      expect(ar.state.name).toBe('Анна');
      expect(ar.state.telegramId).toBe(789);
      expect(ar.state.roles).toEqual([Role.GUEST]);
      expect(ar.state.uuid).toBeString();
      expect(ar.state.createdAt).toBeString();
      expect(ar.state.updatedAt).toBeUndefined();
    });

    test('сохраняет nick если передан', () => {
      const ar = UserAr.register({
        name: 'Анна',
        telegramId: 789,
        nick: 'anna_tg',
      });
      expect(ar.state.nick).toBe('anna_tg');
    });
  });

  describe('addRole', () => {
    test('добавляет роль, если её ещё нет', () => {
      const ar = new UserAr(validUser);
      ar.addRole(Role.SUBSCRIBER);
      expect(ar.state.roles).toEqual([Role.ADMIN, Role.SUBSCRIBER]);
    });

    test('не дублирует существующую роль', () => {
      const ar = new UserAr(validUser);
      ar.addRole(Role.ADMIN);
      expect(ar.state.roles).toEqual([Role.ADMIN]);
    });
  });
});
