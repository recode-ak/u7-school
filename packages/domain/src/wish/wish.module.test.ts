import { describe, expect, it } from 'bun:test';
import { checkDefs, formatViolation } from 'dmg-core/arch';
import { indexDefs, normalize } from 'dmg-core/graph';
import { WishModuleDef } from './wish.module';

describe('WishModuleDef', () => {
  it('паспорт: зависимости, агрегат, UC', () => {
    expect(normalize(WishModuleDef)).toMatchObject({
      name: 'wish',
      dependsOn: ['user', 'course', 'questionnaire', 'stream'],
      aggregates: ['wish'],
      useCases: ['createCourseWish', 'createModuleWish', 'cancelWish'],
      reactions: [],
      jobs: [],
    });
  });

  it('checkDefs — без нарушений', () => {
    // MAN-06 «событие никто не публикует» — до контрактов ER (Ф10–Ф11):
    // `invited` и `confirmed` публикуют invite-wishers и confirm-wish.
    const violations = checkDefs(indexDefs([WishModuleDef])).filter(
      (x) => x.rule !== 'MAN-06',
    );
    expect(violations.map(formatViolation)).toEqual([]);
  });
});
