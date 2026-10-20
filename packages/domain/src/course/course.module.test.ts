import { describe, expect, it } from 'bun:test';
import { checkDefs, formatViolation } from 'dmg-core/arch';
import { indexDefs, normalize } from 'dmg-core/graph';
import { CourseModuleDef } from './contract';

describe('CourseModuleDef — внешний модуль (D-37)', () => {
  it('паспорт: внешний, зависит от user, без состава', () => {
    expect(CourseModuleDef.external).toBe(true);
    expect(normalize(CourseModuleDef)).toMatchObject({
      dependsOn: ['user'],
      aggregates: [],
      useCases: [],
      reactions: [],
      jobs: [],
    });
  });

  it('checkDefs — без нарушений', () => {
    expect(
      checkDefs(indexDefs([CourseModuleDef])).map(formatViolation),
    ).toEqual([]);
  });
});
