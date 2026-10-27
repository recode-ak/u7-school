import { describe, expect, expectTypeOf, it } from 'bun:test';
import { Def } from '#core/kernel/def/def';
import { type AnyPolicyDef, PolicyDef } from './policy-def';
import { Rule } from './rule';

type User = { id: string; hasRole(role: 'admin'): boolean };
type Ctx = { ownerId: string };

const isOwner = Rule.of({
  name: 'isOwner',
  label: 'Владелец задачи',
  denyMessage: 'Задачу может менять только владелец.',
  check: (subject: User, ctx: Ctx) => subject.id === ctx.ownerId,
});

const TaskPolicy = PolicyDef.define({
  name: 'task',
  label: 'Права на задачи',
  description: 'Кто может менять задачи.',
  rules: {
    canComplete: isOwner,
    canRemove: Rule.allOf(Rule.hasRole('admin'), isOwner),
  },
});

describe('PolicyDef', () => {
  it('экземпляр вида; тексты и правила-ссылки из спеки', () => {
    expect(TaskPolicy).toBeInstanceOf(PolicyDef);
    expect(TaskPolicy).toBeInstanceOf(Def);
    expect(TaskPolicy.dmg).toBe('policy');
    expect(TaskPolicy.name).toBe('task');
    expect(TaskPolicy.rules.canComplete).toBe(isOwner);
  });

  it('литеральные типы правил сохраняются; совместим с AnyPolicyDef', () => {
    expectTypeOf(TaskPolicy.rules.canComplete).toEqualTypeOf<typeof isOwner>();
    expectTypeOf(TaskPolicy.name).toEqualTypeOf<'task'>();
    expectTypeOf(TaskPolicy).toExtend<AnyPolicyDef>();
  });

  it('normalize: тексты и вопросы → нормализованные правила', () => {
    expect(TaskPolicy.normalize()).toEqual({
      dmg: 'policy',
      name: 'task',
      label: 'Права на задачи',
      description: 'Кто может менять задачи.',
      rules: {
        canComplete: isOwner.normalize(),
        canRemove: TaskPolicy.rules.canRemove.normalize(),
      },
    });
  });

  it('describe: тексты без схем (MAN-01)', () => {
    expect(TaskPolicy.describe()).toEqual({
      label: 'Права на задачи',
      description: 'Кто может менять задачи.',
      schemas: [],
    });
  });
});
