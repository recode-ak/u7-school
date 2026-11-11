import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { UserArDef } from './user.ar';
import { USER } from './user.fixture';

// Перенос схемных проверок `UserSchema` (TST-09: логика модуля, не поля).
// Фолбэки дат работают только в `UserArDef.state` (D-36).
const legacy = {
  uuid: USER,
  name: 'Иван',
  telegramId: 123,
  roles: ['GUEST'],
  createdAt: '2026-06-25T12:00',
};

const parse = (value: unknown) => v.safeParse(UserArDef.state, value);

describe('UserState — legacy-запись', () => {
  it('ISO-дата без зоны читается как UTC-число, updatedAt = createdAt, version = 0', () => {
    const res = parse(legacy);
    expect(res.success).toBe(true);
    if (res.success) {
      const t = Date.UTC(2026, 5, 25, 12);
      expect([res.output.createdAt, res.output.updatedAt]).toEqual([t, t]);
      expect(res.output.version).toBe(0);
    }
  });
});

describe('UserState — роли и имя', () => {
  it('имя обрезается по краям', () => {
    const res = parse({ ...legacy, name: '  Иван  ' });
    expect(res.success && res.output.name).toBe('Иван');
  });

  it('запись со STUDENT отклоняется: роль снята (скрипт миграции чистит данные)', () => {
    expect(parse({ ...legacy, roles: ['STUDENT'] }).success).toBe(false);
    expect(parse({ ...legacy, roles: ['GUEST', 'STUDENT'] }).success).toBe(
      false,
    );
  });

  it.each([
    { title: 'пустой roles', value: { ...legacy, roles: [] } },
    { title: 'неизвестная роль', value: { ...legacy, roles: ['OWNER'] } },
    { title: 'пустой nick после trim', value: { ...legacy, nick: '  ' } },
  ])('отклоняет: $title', ({ value }) => {
    expect(parse(value).success).toBe(false);
  });
});
