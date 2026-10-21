import { describe, expect, it } from 'bun:test';
import {
  type Caller,
  DelegateCaller,
  GuestCaller,
  type OperationRef,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { definePolicy } from './define-policy';
import {
  allOf,
  allowAll,
  allowed,
  anyOf,
  denied,
  hasRole,
  rule,
} from './policy';

type Role = 'admin' | 'author';
type User = { uuid: string; id: string; hasRole(role: Role): boolean };
type Ctx = { ownerId: string };

const user = (id: string, ...roles: Role[]): User => ({
  uuid: id,
  id,
  hasRole: (role) => roles.includes(role),
});
const as = (u: User) => new UserCaller(u);
const delegateOf = (subject: User) =>
  new DelegateCaller(subject, user('zam'), 'd1');
const job: OperationRef = { kind: 'job', module: 'todo', name: 'archive' };

const isOwner = rule({
  name: 'isOwner',
  label: 'Владелец задачи',
  denyMessage: 'Задачу может менять только владелец.',
  check: (subject: User, ctx: Ctx) => subject.id === ctx.ownerId,
});

const ownPrivate = rule({
  name: 'ownPrivate',
  label: 'Личное действие владельца',
  denyMessage: 'Только сам владелец.',
  delegable: false,
  check: (subject: User, ctx: Ctx) => subject.id === ctx.ownerId,
});

const ctx: Ctx = { ownerId: 'u1' };

describe('rule', () => {
  it('allowed, если проверка субъекта прошла', () => {
    expect(isOwner.evaluate(as(user('u1')), ctx)).toEqual(allowed);
  });

  it('denied(rule, denyMessage), если нет', () => {
    expect(isOwner.evaluate(as(user('u2')), ctx)).toEqual(
      denied('isOwner', 'Задачу может менять только владелец.'),
    );
  });

  it('проверяет субъекта, а не исполнителя делегирования', () => {
    expect(isOwner.evaluate(delegateOf(user('u1')), ctx)).toEqual(allowed);
  });

  it('delegable: false отказывает delegate', () => {
    expect(ownPrivate.evaluate(as(user('u1')), ctx)).toEqual(allowed);
    const res = ownPrivate.evaluate(delegateOf(user('u1')), ctx);
    expect(res).toEqual(
      denied(
        'ownPrivate',
        'Недоступно по делегированию: Личное действие владельца.',
      ),
    );
  });

  it('system с человеком — субъект и делегирование по человеку (D-43)', () => {
    const from: OperationRef = {
      kind: 'useCase',
      module: 'wish',
      name: 'notify',
    };
    expect(
      isOwner.evaluate(new SystemCaller(from, as(user('u1'))), ctx),
    ).toEqual(allowed);
    expect(
      isOwner.evaluate(new SystemCaller(from, as(user('u2'))), ctx).allowed,
    ).toBe(false);
    const viaDelegate = new SystemCaller(from, delegateOf(user('u1')));
    expect(isOwner.evaluate(viaDelegate, ctx)).toEqual(allowed);
    expect(ownPrivate.evaluate(viaDelegate, ctx).allowed).toBe(false);
  });

  it('без субъекта (guest, system без человека) — отказ', () => {
    expect(isOwner.evaluate(new GuestCaller(), ctx).allowed).toBe(false);
    expect(isOwner.evaluate(new SystemCaller(job), ctx).allowed).toBe(false);
  });
});

describe('allowAll', () => {
  it('пропускает любого вызывающего, включая guest и system', () => {
    expect(allowAll.evaluate(new GuestCaller(), undefined)).toEqual(allowed);
    expect(allowAll.evaluate(new SystemCaller(job), undefined)).toEqual(
      allowed,
    );
  });
});

describe('hasRole', () => {
  it('allowed с ролью, denied без неё', () => {
    const admin = hasRole('admin');
    expect(admin.evaluate(as(user('u1', 'admin')), undefined)).toEqual(allowed);
    expect(admin.evaluate(as(user('u1')), undefined)).toEqual(
      denied('hasRole:admin', 'Нужна роль admin.'),
    );
  });
});

describe('композиция', () => {
  const canEdit = anyOf(
    {
      name: 'canEdit',
      label: 'Владелец или администратор',
      denyMessage: 'Менять задачу может владелец или администратор.',
    },
    hasRole('admin'),
    isOwner,
  );

  it('anyOf: достаточно одного правила', () => {
    expect(canEdit.evaluate(as(user('u2', 'admin')), ctx)).toEqual(allowed);
    expect(canEdit.evaluate(as(user('u1')), ctx)).toEqual(allowed);
  });

  it('anyOf: отказ — со своим правилом и сообщением', () => {
    expect(canEdit.evaluate(as(user('u2')), ctx)).toEqual(
      denied('canEdit', 'Менять задачу может владелец или администратор.'),
    );
  });

  it('allOf: отказ — первое не прошедшее правило', () => {
    const canPublish = allOf(hasRole('author'), isOwner);
    expect(canPublish.evaluate(as(user('u1', 'author')), ctx)).toEqual(allowed);
    expect(canPublish.evaluate(as(user('u2', 'author')), ctx)).toEqual(
      denied('isOwner', 'Задачу может менять только владелец.'),
    );
    expect(canPublish.evaluate(as(user('u2')), ctx)).toEqual(
      denied('hasRole:author', 'Нужна роль author.'),
    );
  });

  it('субъект композиции — пересечение субъектов правил (тип)', () => {
    const both = allOf(hasRole('admin'), hasRole('author'), isOwner);
    expect(both.evaluate(as(user('u1', 'admin', 'author')), ctx)).toEqual(
      allowed,
    );
    const roleOnly: Caller<{ uuid: string; hasRole(role: Role): boolean }> =
      new UserCaller({ uuid: 'r', hasRole: () => true });
    // @ts-expect-error у субъекта нет id, нужного isOwner
    both.evaluate(roleOnly, ctx);
  });

  it('контекст композиции — объединение контекстов правил (тип)', () => {
    const both = allOf(isOwner, hasRole('admin'));
    // @ts-expect-error нет ownerId
    both.evaluate(as(user('u1')), {});
    expect(both.evaluate(as(user('u1', 'admin')), ctx)).toEqual(allowed);
  });
});

describe('definePolicy', () => {
  it('Def несёт метаданные и правила-ссылки', () => {
    const TaskPolicy = definePolicy({
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
