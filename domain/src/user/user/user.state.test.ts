import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { UserArDef } from './user.ar';
import { USER } from './user.fixture';

// Перенос схемных проверок `UserSchema` (TST-09: логика, не поля).
// Фолбэки дат работают только в `UserArDef.state` (D-36).
const legacy = {
  uuid: USER,
  name: 'Иван',
  telegramId: 123,
  roles: ['GUEST'],
  createdAt: '2026-06-25T12:00',
};

const parse = (value: unknown) => v.safeParse(UserArDef.state, value);

describe('UserState — legacy-запись (D-36)', () => {
  it('ISO-дата без зоны читается как UTC-число, updatedAt = createdAt, version = 0', () => {
    const res = parse(legacy);
    expect(res.success).toBe(true);
    if (res.success) {
      const t = Date.UTC(2026, 5, 25, 12);
      expect([res.output.createdAt, res.output.updatedAt]).toEqual([t, t]);
      expect(res.output.version).toBe(0);
    }
  });

  it('запись нового формата (числа, version) читается как есть', () => {
    const t = Date.UTC(2026, 5, 25, 12);
    const res = parse({
      ...legacy,
      createdAt: t,
      updatedAt: t + 5,
      version: 3,
    });
    expect(res.success && [res.output.updatedAt, res.output.version]).toEqual([
      t + 5,
      3,
    ]);
  });
});

describe('UserState — поля', () => {
  it('имя и nick обрезаются по краям', () => {
    const res = parse({ ...legacy, name: '  Иван  ', nick: ' ivan ' });
    expect(res.success && [res.output.name, res.output.nick]).toEqual([
      'Иван',
      'ivan',
    ]);
  });

  it('запись со STUDENT проходит (до Ф3)', () => {
    expect(parse({ ...legacy, roles: ['STUDENT'] }).success).toBe(true);
  });

  it.each(['GUEST', 'SUBSCRIBER', 'STUDENT', 'MENTOR', 'AUTHOR', 'ADMIN'])(
    'принимает роль %s',
    (role) => {
      expect(parse({ ...legacy, roles: [role] }).success).toBe(true);
    },
  );

  it('без nick — ключа в результате нет', () => {
    const res = parse(legacy);
    expect(res.success && 'nick' in res.output).toBe(false);
  });

  it.each([
    { title: 'пустой roles', value: { ...legacy, roles: [] } },
    { title: 'неизвестная роль', value: { ...legacy, roles: ['OWNER'] } },
    { title: 'пустое имя после trim', value: { ...legacy, name: '   ' } },
    { title: 'пустой nick после trim', value: { ...legacy, nick: '  ' } },
    { title: 'uuid не uuid', value: { ...legacy, uuid: 'bad' } },
    { title: 'telegramId = 0', value: { ...legacy, telegramId: 0 } },
    { title: 'отрицательный telegramId', value: { ...legacy, telegramId: -5 } },
    { title: 'дробный telegramId', value: { ...legacy, telegramId: 1.5 } },
  ])('отклоняет: $title', ({ value }) => {
    expect(parse(value).success).toBe(false);
  });
});
