// Тесты типов Def (трек dmg-core-oop, спека п.2): что должно сохраниться
// при переходе Def на классы. Те же требования на классе вида —
// `use-case-def.test.ts`.
import { describe, expect, expectTypeOf, it } from 'bun:test';
import {
  CompleteTaskUcDef,
  type GetUserUcDef,
  type ListTasksUcDef,
  type TaskPolicy,
  TodoModuleDef,
} from './contracts.fixture';
import type { AnyUseCaseDef, InputOf } from './define-use-case';

describe('типы Def: текущий DSL', () => {
  it('литеральные типы calls, policy, useCases, InputOf', () => {
    expectTypeOf<(typeof CompleteTaskUcDef)['calls'][number]>().toEqualTypeOf<
      typeof GetUserUcDef
    >();
    expectTypeOf<(typeof CompleteTaskUcDef)['policy']>().toEqualTypeOf<
      typeof TaskPolicy.rules.canComplete
    >();
    expectTypeOf<(typeof TodoModuleDef)['useCases'][number]>().toEqualTypeOf<
      typeof CompleteTaskUcDef | typeof ListTasksUcDef
    >();
    expectTypeOf<InputOf<typeof CompleteTaskUcDef>>().toEqualTypeOf<{
      taskId: string;
    }>();
  });

  it('конкретный Def совместим с Any*Def', () => {
    expectTypeOf<typeof CompleteTaskUcDef>().toExtend<AnyUseCaseDef>();
  });

  it('сравнение по ссылке: includes и ключи Map', () => {
    const list: readonly AnyUseCaseDef[] = TodoModuleDef.useCases;
    expect(list.includes(CompleteTaskUcDef)).toBe(true);
    const byDef = new Map<AnyUseCaseDef, string>([[CompleteTaskUcDef, 'c']]);
    expect(byDef.get(CompleteTaskUcDef)).toBe('c');
  });
});
