import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { UserArDef } from './user.ar';
import { USER } from './user.fixture';

// Проверки схемы состояния пользователя (TST-09: логика модуля, не поля).
// Фолбэки дат работают только в `UserArDef.state` (D-36).
const record = {
  uuid: USER,
  name: 'Иван',
  telegramId: 123,
  roles: ['GUEST'],
  createdAt: Date.UTC(2026, 5, 25, 12),
};

const parse = (value: unknown) => v.safeParse(UserArDef.state, value);

describe('UserState — даты и фолбэки', () => {
  it('нет updatedAt и version → updatedAt = createdAt, version = 0', () => {
    const res = parse(record);
    expect(res.success).toBe(true);
    if (res.success) {
      const t = Date.UTC(2026, 5, 25, 12);
      expect([res.output.createdAt, res.output.updatedAt]).toEqual([t, t]);
      expect(res.output.version).toBe(0);
    }
  });

  it('ISO-строка в дате отвергается', () => {
    expect(parse({ ...record, createdAt: '2026-06-25T12:00' }).success).toBe(
      false,
    );
  });
});

describe('UserState — роли и имя', () => {
  it('имя обрезается по краям', () => {
    const res = parse({ ...record, name: '  Иван  ' });
    expect(res.success && res.output.name).toBe('Иван');
  });

  it('запись со STUDENT отклоняется: роль снята (скрипт миграции чистит данные)', () => {
    expect(parse({ ...record, roles: ['STUDENT'] }).success).toBe(false);
    expect(parse({ ...record, roles: ['GUEST', 'STUDENT'] }).success).toBe(
      false,
    );
  });

  it('принимает все роли платформы: список ролей — часть контракта', () => {
    for (const role of ['GUEST', 'SUBSCRIBER', 'MENTOR', 'AUTHOR', 'ADMIN']) {
      expect(parse({ ...record, roles: [role] }).success).toBe(true);
    }
  });

  it.each([
    { title: 'пустой roles', value: { ...record, roles: [] } },
    { title: 'неизвестная роль', value: { ...record, roles: ['OWNER'] } },
    { title: 'пустой nick после trim', value: { ...record, nick: '  ' } },
  ])('отклоняет: $title', ({ value }) => {
    expect(parse(value).success).toBe(false);
  });
});
