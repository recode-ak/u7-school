import { describe, expect, it } from 'bun:test';
import { checkDefs, formatViolation } from 'dmg-core/arch';
import { indexDefs, normalize } from 'dmg-core/graph';
import { UserModuleDef } from './contract';

describe('UserModuleDef — внешний модуль (D-37)', () => {
  it('паспорт: внешний, без зависимостей и состава', () => {
    expect(UserModuleDef.external).toBe(true);
    expect(normalize(UserModuleDef)).toMatchObject({
      dependsOn: [],
      aggregates: [],
      useCases: [],
      reactions: [],
      jobs: [],
    });
  });

  it('checkDefs — без нарушений', () => {
    expect(checkDefs(indexDefs([UserModuleDef])).map(formatViolation)).toEqual(
      [],
    );
  });
});
