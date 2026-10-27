import { describe, expect, expectTypeOf, it } from 'bun:test';
import * as v from 'valibot';
import { Def } from '#core/kernel/def/def';
import { ErrorDef } from '#core/kernel/errors/error-def';
import { F } from '#core/kernel/fields/fields';
import { ok } from '#core/kernel/result/result';
import {
  type AnyDomainRule,
  type DomainRuleContextOf,
  DomainRuleDef,
} from './domain-rule-def';
import { type AnyRulesDef, RulesDef } from './rules-def';

const ShelfErrors = ErrorDef.define('SHELF', {
  FULL: {
    kind: 'conflict',
    label: 'Полка заполнена',
    description: 'На полке нет места для новой книги.',
    payload: v.object({ limit: F.int('Вместимость полки') }),
  },
});

type ShelfCtx = { readonly shelf: { isFull(): boolean } };

const hasRoom = DomainRuleDef.define({
  name: 'hasRoom',
  label: 'На полке есть место',
  description: 'Книгу можно поставить, только если полка не заполнена.',
  error: ShelfErrors.FULL,
  check: (ctx: ShelfCtx) =>
    ctx.shelf.isFull() ? ShelfErrors.FULL.err({ limit: 3 }) : ok(),
});

const OtherErrors = ErrorDef.define('OTHER', {
  FAILED: { kind: 'conflict', label: 'Сбой', description: 'Чужая ошибка.' },
});

const ShelfRules = RulesDef.define({
  name: 'shelf',
  label: 'Правила полки',
  description: 'Допустимость действий с полкой при её состоянии.',
  rules: { hasRoom },
});

describe('DomainRuleDef', () => {
  it('экземпляр вида; check — свойство из спеки', () => {
    expect(hasRoom).toBeInstanceOf(DomainRuleDef);
    expect(hasRoom).toBeInstanceOf(Def);
    expect(hasRoom.dmg).toBe('domainRule');
    expect(hasRoom.check({ shelf: { isFull: () => false } })).toEqual(ok());
    expect(hasRoom.check({ shelf: { isFull: () => true } })).toEqual(
      ShelfErrors.FULL.err({ limit: 3 }),
    );
  });

  it('контекст выводится из check; совместим с AnyDomainRule', () => {
    expectTypeOf<
      DomainRuleContextOf<typeof hasRoom>
    >().toEqualTypeOf<ShelfCtx>();
    expectTypeOf(hasRoom).toExtend<AnyDomainRule>();
  });

  it('check возвращает только свою ошибку (DOM-16)', () => {
    DomainRuleDef.define({
      name: 'foreign',
      label: 'Чужая ошибка',
      description: 'Правило пытается вернуть не свою ошибку.',
      error: ShelfErrors.FULL,
      // @ts-expect-error OTHER_FAILED — не ошибка из `error` правила
      check: () => OtherErrors.FAILED.err(),
    });
  });

  it('check контравариантен: правило с чужим контекстом не подходит', () => {
    type Other = { readonly other: true };
    // @ts-expect-error контекст правила — ShelfCtx, а не Other
    const wrong: DomainRuleDef<Other, typeof ShelfErrors.FULL> = hasRoom;
    expect(wrong).toBeDefined();
  });

  it('normalize() — тексты и код ошибки отказа', () => {
    expect(hasRoom.normalize()).toEqual({
      dmg: 'domainRule',
      name: 'hasRoom',
      label: 'На полке есть место',
      description: 'Книгу можно поставить, только если полка не заполнена.',
      error: 'SHELF_FULL',
    });
  });

  it('describe() — без схем', () => {
    expect(hasRoom.describe().schemas).toEqual([]);
  });
});

describe('RulesDef', () => {
  it('экземпляр вида с правилами по ссылке', () => {
    expect(ShelfRules).toBeInstanceOf(RulesDef);
    expect(ShelfRules.dmg).toBe('rules');
    expect(ShelfRules.rules.hasRoom).toBe(hasRoom);
    expectTypeOf(ShelfRules.rules.hasRoom).toEqualTypeOf<typeof hasRoom>();
    expectTypeOf(ShelfRules).toExtend<AnyRulesDef>();
  });

  it('normalize() — правила в нормализованной форме', () => {
    expect(ShelfRules.normalize()).toEqual({
      dmg: 'rules',
      name: 'shelf',
      label: 'Правила полки',
      description: 'Допустимость действий с полкой при её состоянии.',
      rules: { hasRoom: hasRoom.normalize() },
    });
  });
});
