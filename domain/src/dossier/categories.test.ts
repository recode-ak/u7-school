import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { SkillMappingSchema } from './categories';

describe('SkillMapping', () => {
  test('валидная связь категория↔подкатегория проходит', () => {
    const mapping = {
      category: 'professional_skills',
      subcategory: 'work_quality',
      weight: 1.0,
    };
    expect(() => v.parse(SkillMappingSchema, mapping)).not.toThrow();
  });

  test('подкатегория другой категории — ошибка', () => {
    const mapping = {
      category: 'professional_skills',
      subcategory: 'communication',
      weight: 1.0,
    };
    expect(() => v.parse(SkillMappingSchema, mapping)).toThrow();
  });
});
