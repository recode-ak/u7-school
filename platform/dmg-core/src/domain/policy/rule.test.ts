import { describe, expect, it } from 'bun:test';
import {
  AllOfRule,
  AllowAll,
  AnyOfRule,
  type AnyRule,
  allowAll,
  allowed,
  denied,
  NamedRule,
  Rule,
} from './rule';

type Role = 'admin' | 'author';
type User = { id: string; hasRole(role: Role): boolean };
type Ctx = { ownerId: string };

const user = (id: string, ...roles: Role[]): User => ({
  id,
  hasRole: (role) => roles.includes(role),
});

const isOwner = Rule.of({
  name: 'isOwner',
  label: 'Владелец задачи',
  denyMessage: 'Задачу может менять только владелец.',
  check: (subject: User, ctx: Ctx) => subject.id === ctx.ownerId,
});

const canEdit = Rule.anyOf(
  {
    name: 'canEdit',
    label: 'Владелец или администратор',
    denyMessage: 'Менять задачу может владелец или администратор.',
  },
  Rule.hasRole('admin'),
  isOwner,
);

const ctx: Ctx = { ownerId: 'u1' };

describe('иерархия Rule', () => {
  it('фабрики создают наследников абстрактного Rule', () => {
    expect(isOwner).toBeInstanceOf(NamedRule);
    expect(Rule.hasRole('admin')).toBeInstanceOf(NamedRule);
    expect(Rule.allOf(isOwner)).toBeInstanceOf(AllOfRule);
    expect(canEdit).toBeInstanceOf(AnyOfRule);
    expect(allowAll).toBeInstanceOf(AllowAll);
    for (const r of [isOwner, Rule.allOf(isOwner), canEdit, allowAll]) {
      expect(r).toBeInstanceOf(Rule);
      expect(r.dmg).toBe('rule');
    }
  });

  it('op — вид правила, как в нормализованной форме', () => {
    expect(isOwner.op).toBe('rule');
    expect(Rule.allOf(isOwner).op).toBe('allOf');
    expect(canEdit.op).toBe('anyOf');
    expect(allowAll.op).toBe('allowAll');
  });

  it('любое правило подходит под AnyRule (тип)', () => {
    const rules: readonly AnyRule[] = [isOwner, canEdit, allowAll];
    expect(rules).toHaveLength(3);
  });
});

describe('evaluate', () => {
  it('NamedRule: allowed / denied(rule, denyMessage); без субъекта check не вызван', () => {
    expect(isOwner.evaluate(user('u1'), ctx)).toEqual(allowed);
    expect(isOwner.evaluate(user('u2'), ctx)).toEqual(
      denied('isOwner', 'Задачу может менять только владелец.'),
    );
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

  it('AllOfRule: отказ — первое не прошедшее', () => {
    const canPublish = Rule.allOf(Rule.hasRole('author'), isOwner);
    expect(canPublish.evaluate(user('u1', 'author'), ctx)).toEqual(allowed);
    expect(canPublish.evaluate(user('u2'), ctx)).toEqual(
      denied('hasRole:author', 'Нужна роль author.'),
    );
  });

  it('AnyOfRule: достаточно одного; отказ — со своим именем', () => {
    expect(canEdit.evaluate(user('u2', 'admin'), ctx)).toEqual(allowed);
    expect(canEdit.evaluate(user('u2'), ctx)).toEqual(
      denied('canEdit', 'Менять задачу может владелец или администратор.'),
    );
  });

  it('AllowAll: пропускает и без субъекта', () => {
    expect(allowAll.evaluate(undefined, undefined)).toEqual(allowed);
  });

  it('субъект композиции — пересечение субъектов правил (тип)', () => {
    const both = Rule.allOf(Rule.hasRole('admin'), isOwner);
    const roleOnly = { hasRole: () => true };
    // @ts-expect-error у субъекта нет id, нужного isOwner
    both.evaluate(roleOnly, ctx);
    // @ts-expect-error нет ownerId в контексте
    both.evaluate(user('u1'), {});
    expect(both.evaluate(user('u1', 'admin'), ctx)).toEqual(allowed);
  });

  it('evaluate строго контравариантен по субъекту (тип)', () => {
    // @ts-expect-error чужой субъект
    isOwner.evaluate({ name: 'x' }, ctx);
  });
});

describe('normalize', () => {
  it('каждый вид даёт свою форму, вложенные — рекурсивно', () => {
    expect(Rule.allOf(Rule.hasRole('author'), canEdit).normalize()).toEqual({
      dmg: 'rule',
      op: 'allOf',
      rules: [
        {
          dmg: 'rule',
          op: 'rule',
          name: 'hasRole:author',
          label: 'Роль author',
          denyMessage: 'Нужна роль author.',
        },
        {
          dmg: 'rule',
          op: 'anyOf',
          name: 'canEdit',
          label: 'Владелец или администратор',
          denyMessage: 'Менять задачу может владелец или администратор.',
          rules: [
            {
              dmg: 'rule',
              op: 'rule',
              name: 'hasRole:admin',
              label: 'Роль admin',
              denyMessage: 'Нужна роль admin.',
            },
            {
              dmg: 'rule',
              op: 'rule',
              name: 'isOwner',
              label: 'Владелец задачи',
              denyMessage: 'Задачу может менять только владелец.',
            },
          ],
        },
      ],
    });
    expect(allowAll.normalize()).toEqual({ dmg: 'rule', op: 'allowAll' });
  });
});
