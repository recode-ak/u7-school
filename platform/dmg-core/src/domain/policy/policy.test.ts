import { describe, expect, it } from 'bun:test';
import { UserCaller } from '#core/kernel/caller/caller';
import { PolicyDef } from './policy-def';
import { allowAll, allowed, denied, Rule } from './rule';

type Role = 'admin' | 'author';
type User = { uuid: string; id: string; hasRole(role: Role): boolean };
type Ctx = { ownerId: string };

const user = (id: string, ...roles: Role[]): User => ({
  uuid: id,
  id,
  hasRole: (role) => roles.includes(role),
});

const isOwner = Rule.of({
  name: 'isOwner',
  label: 'Владелец задачи',
  denyMessage: 'Задачу может менять только владелец.',
  check: (subject: User, ctx: Ctx) => subject.id === ctx.ownerId,
});

const ctx: Ctx = { ownerId: 'u1' };

describe('Rule.of', () => {
  it('allowed, если проверка субъекта прошла', () => {
    expect(isOwner.evaluate(user('u1'), ctx)).toEqual(allowed);
  });

  it('denied(rule, denyMessage), если нет', () => {
    expect(isOwner.evaluate(user('u2'), ctx)).toEqual(
      denied('isOwner', 'Задачу может менять только владелец.'),
    );
  });

  it('без субъекта (guest, system без человека) — отказ, check не вызван', () => {
    let called = false;
    const spy = Rule.of({
      name: 'spy',
      label: 'Шпион',
      denyMessage: 'Нужен субъект.',
      check: () => {
        called = true;
        return true;
      },
    });
    expect(spy.evaluate(undefined, undefined)).toEqual(
      denied('spy', 'Нужен субъект.'),
    );
    expect(called).toBe(false);
  });

  it('вид вызывающего правило не знает: принимает субъекта, а не Caller (тип)', () => {
    // @ts-expect-error Caller — не субъект правила (D-43, Р2)
    isOwner.evaluate(new UserCaller(user('u1')), ctx);
  });

  it('у правила нет признака делегирования (D-43, Р2)', () => {
    expect('delegable' in isOwner).toBe(false);
  });
});

describe('allowAll', () => {
  it('пропускает с субъектом и без него', () => {
    expect(allowAll.evaluate(undefined, undefined)).toEqual(allowed);
    expect(allowAll.evaluate(user('u1'), undefined)).toEqual(allowed);
  });
});

describe('Rule.hasRole', () => {
  it('allowed с ролью, denied без неё', () => {
    const admin = Rule.hasRole('admin');
    expect(admin.evaluate(user('u1', 'admin'), undefined)).toEqual(allowed);
    expect(admin.evaluate(user('u1'), undefined)).toEqual(
      denied('hasRole:admin', 'Нужна роль admin.'),
    );
  });
});

describe('композиция', () => {
  const canEdit = Rule.anyOf(
    {
      name: 'canEdit',
      label: 'Владелец или администратор',
      denyMessage: 'Менять задачу может владелец или администратор.',
    },
    Rule.hasRole('admin'),
    isOwner,
  );

  it('anyOf: достаточно одного правила', () => {
    expect(canEdit.evaluate(user('u2', 'admin'), ctx)).toEqual(allowed);
    expect(canEdit.evaluate(user('u1'), ctx)).toEqual(allowed);
  });

  it('anyOf: отказ — со своим правилом и сообщением', () => {
    expect(canEdit.evaluate(user('u2'), ctx)).toEqual(
      denied('canEdit', 'Менять задачу может владелец или администратор.'),
    );
  });

  it('allOf: отказ — первое не прошедшее правило', () => {
    const canPublish = Rule.allOf(Rule.hasRole('author'), isOwner);
    expect(canPublish.evaluate(user('u1', 'author'), ctx)).toEqual(allowed);
    expect(canPublish.evaluate(user('u2', 'author'), ctx)).toEqual(
      denied('isOwner', 'Задачу может менять только владелец.'),
    );
    expect(canPublish.evaluate(user('u2'), ctx)).toEqual(
      denied('hasRole:author', 'Нужна роль author.'),
    );
  });

  it('субъект композиции — пересечение субъектов правил (тип)', () => {
    const both = Rule.allOf(
      Rule.hasRole('admin'),
      Rule.hasRole('author'),
      isOwner,
    );
    expect(both.evaluate(user('u1', 'admin', 'author'), ctx)).toEqual(allowed);
    const roleOnly: { hasRole(role: Role): boolean } = {
      hasRole: () => true,
    };
    // @ts-expect-error у субъекта нет id, нужного isOwner
    both.evaluate(roleOnly, ctx);
  });

  it('контекст композиции — объединение контекстов правил (тип)', () => {
    const both = Rule.allOf(isOwner, Rule.hasRole('admin'));
    // @ts-expect-error нет ownerId
    both.evaluate(user('u1'), {});
    expect(both.evaluate(user('u1', 'admin'), ctx)).toEqual(allowed);
  });
});

describe('PolicyDef.define', () => {
  it('Def несёт метаданные и правила-ссылки', () => {
    const TaskPolicy = PolicyDef.define({
      name: 'task',
      label: 'Права на задачи',
      description: 'Кто может менять задачи.',
      rules: { canComplete: isOwner },
    });
    expect(TaskPolicy.dmg).toBe('policy');
    expect(TaskPolicy.name).toBe('task');
    expect(TaskPolicy.rules.canComplete).toBe(isOwner);
  });
});
