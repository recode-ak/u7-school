import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StudentErrors } from './student.errors';

// Ошибки агрегата `student` (ERR-04): код, вид и статичный `label` (Т14 Ф1).
// Тексты — дословно из legacy-исключений v0.2.6 (решение 7 брифа).

describe('StudentErrors — коды и kind', () => {
  it('одиннадцать ошибок группы STUDENT', () => {
    expect(
      Object.values(StudentErrors)
        .map((e): string[] => [e.code, e.kind])
        .sort(),
    ).toEqual(
      [
        ['STUDENT_NOT_FOUND', 'not_found'],
        ['STUDENT_WRONG_ENROLLMENT_KEY', 'validation'],
        ['STUDENT_ALREADY_STUDYING', 'conflict'],
        ['STUDENT_PREREQUISITE_NOT_PASSED', 'conflict'],
        ['STUDENT_NO_STEPS', 'conflict'],
        ['STUDENT_STEP_NOT_IN_STREAM', 'validation'],
        ['STUDENT_STEP_NOT_ISSUED', 'conflict'],
        ['STUDENT_STEP_ALREADY_ISSUED', 'conflict'],
        ['STUDENT_NOT_ENROLLED', 'conflict'],
        ['STUDENT_NOT_STUDYING', 'conflict'],
        ['STUDENT_NOT_COMPLETABLE', 'conflict'],
      ].sort(),
    );
  });
});

describe('StudentErrors — тексты, видимые пользователю', () => {
  it.each([
    ['NOT_FOUND', 'Студент не найден'],
    ['WRONG_ENROLLMENT_KEY', 'Неверное кодовое слово'],
    ['ALREADY_STUDYING', 'Вы уже проходите обучение в другом потоке'],
    ['PREREQUISITE_NOT_PASSED', 'Сначала пройдите предыдущий модуль'],
    ['NO_STEPS', 'В потоке нет доступных шагов'],
    ['STEP_NOT_IN_STREAM', 'Шаг не найден в структуре потока'],
    ['STEP_NOT_ISSUED', 'Нельзя завершить шаг: он не был выдан студенту.'],
    ['NOT_STUDYING', 'Нельзя снять студента с учёбы: он уже не учится.'],
    ['NOT_COMPLETABLE', 'Нельзя завершить студента: он не учится.'],
  ] as const)('%s', (code, label) => {
    expect(StudentErrors[code].label).toBe(label);
  });

  it('тексты переходов не содержат сырого статуса (Т10)', () => {
    for (const code of [
      'NOT_STUDYING',
      'NOT_COMPLETABLE',
      'NOT_ENROLLED',
    ] as const) {
      expect(StudentErrors[code].label).not.toMatch(
        /'(enrolled|active|abandoned)'/,
      );
    }
  });
});

describe('StudentErrors — payload', () => {
  it('PREREQUISITE_NOT_PASSED несёт moduleTitle', () => {
    const { payload } = StudentErrors.PREREQUISITE_NOT_PASSED;
    expect(payload).toBeDefined();
    if (payload) {
      expect(v.safeParse(payload, { moduleTitle: 'Основы' }).success).toBe(
        true,
      );
      expect(v.safeParse(payload, {}).success).toBe(false);
    }
    expect(
      StudentErrors.PREREQUISITE_NOT_PASSED.make({ moduleTitle: 'Основы' })
        .payload,
    ).toEqual({ moduleTitle: 'Основы' });
  });
});
