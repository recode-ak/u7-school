import { describe, expect, expectTypeOf, it } from 'bun:test';
import * as v from 'valibot';
import { defineErrors } from '#core/kernel/errors/define-errors';
import { F } from '#core/kernel/fields/fields';
import { ok } from '#core/kernel/result/result';
import { defineRules } from './define-rules';
import {
  type AnyDomainRule,
  type DomainRuleContextOf,
  domainRule,
} from './domain-rule';

const ShelfErrors = defineErrors('SHELF', {
  FULL: {
    kind: 'conflict',
    label: 'Полка заполнена',
    description: 'На полке нет места для новой книги.',
    payload: v.object({ limit: F.int('Вместимость полки') }),
  },
});

const OtherErrors = defineErrors('OTHER', {
  FAILED: { kind: 'conflict', label: 'Сбой', description: 'Чужая ошибка.' },
});

/** Ответ правила — у «агрегата» (D-39): правило только спрашивает. */
type ShelfCtx = { readonly shelf: { isFull(): boolean; capacity(): number } };

const hasRoom = domainRule({
  name: 'hasRoom',
  label: 'На полке есть место',
  description: 'Книгу можно поставить, только если полка не заполнена.',
  error: ShelfErrors.FULL,
  check: (ctx: ShelfCtx) =>
    ctx.shelf.isFull()
      ? ShelfErrors.FULL.err({ limit: ctx.shelf.capacity() })
      : ok(),
});

const shelf = (full: boolean): ShelfCtx => ({
  shelf: { isFull: () => full, capacity: () => 3 },
});

describe('domainRule', () => {
  it('ok, если проверка прошла', () => {
    expect(hasRoom.check(shelf(false))).toEqual(ok());
  });

  it('err своей ошибки с payload, если нет', () => {
    const res = hasRoom.check(shelf(true));
    expect(res).toEqual(ShelfErrors.FULL.err({ limit: 3 }));
  });

  it('декларация: имя, тексты, ссылка на ErrorDef', () => {
    expect(hasRoom).toMatchObject({
      dmg: 'domainRule',
      name: 'hasRoom',
      label: 'На полке есть место',
      description: 'Книгу можно поставить, только если полка не заполнена.',
      error: ShelfErrors.FULL,
    });
  });

  it('контекст правила выводится из check', () => {
    expectTypeOf<
      DomainRuleContextOf<typeof hasRoom>
    >().toEqualTypeOf<ShelfCtx>();
  });

  it('правило — AnyDomainRule', () => {
    const any: AnyDomainRule = hasRoom;
    expect(any.name).toBe('hasRoom');
  });

  it('ошибка чужого ErrorDef не компилируется (DOM-16)', () => {
    const foreign = domainRule({
      name: 'foreign',
      label: 'Чужая ошибка',
      description: 'Правило пытается вернуть не свою ошибку.',
      error: ShelfErrors.FULL,
      // @ts-expect-error: OTHER_FAILED — не ошибка из `error` правила
      check: () => OtherErrors.FAILED.err(),
    });
    expect(foreign).toBeDefined();
  });
});

describe('defineRules', () => {
  it('группа правил агрегата — описанный Def', () => {
    const ShelfRules = defineRules({
      name: 'shelf',
      label: 'Правила полки',
      description: 'Допустимость действий с полкой при её состоянии.',
      rules: { hasRoom },
    });
    expect(ShelfRules.dmg).toBe('rules');
    expect(ShelfRules.rules.hasRoom).toBe(hasRoom);
  });
});
