import { expect, test } from 'bun:test';
import {
  isKebab,
  kindNames,
  toCamel,
  toPascal,
  toUpperSnake,
} from './naming.ts';

test('kebab → PascalCase', () => {
  expect(toPascal('complete-student')).toBe('CompleteStudent');
  expect(toPascal('stream')).toBe('Stream');
  expect(toPascal('step-record-2')).toBe('StepRecord2');
});

test('isKebab: допустимые и недопустимые имена', () => {
  expect(isKebab('complete-student')).toBe(true);
  expect(isKebab('a1')).toBe(true);
  for (const bad of ['', 'Complete', 'a_b', '-a', 'a-', 'a--b', '1a', 'a b']) {
    expect(isKebab(bad)).toBe(false);
  }
});

test('kindNames: класс, Def и суффикс файла по таблице naming.md §1, §4', () => {
  expect(kindNames('uc', 'complete-student')).toEqual({
    className: 'CompleteStudentUc',
    defName: 'CompleteStudentUcDef',
    fileName: 'complete-student.uc.ts',
  });
  expect(kindNames('er', 'fulfill-wish').className).toBe('FulfillWishEr');
  expect(kindNames('job', 'inactivity-sweep').defName).toBe(
    'InactivitySweepJobDef',
  );
  expect(kindNames('dcs', 'stream-progress').fileName).toBe(
    'stream-progress.dcs.ts',
  );
  expect(kindNames('dqs', 'stream-navigation').className).toBe(
    'StreamNavigationDqs',
  );
  expect(kindNames('ar', 'student')).toEqual({
    className: 'StudentAr',
    defName: 'StudentArDef',
    fileName: 'student.ar.ts',
  });
});

test('toCamel и toUpperSnake', () => {
  expect(toCamel('stream-student')).toBe('streamStudent');
  expect(toCamel('student')).toBe('student');
  expect(toUpperSnake('stream-student')).toBe('STREAM_STUDENT');
  expect(toUpperSnake('student')).toBe('STUDENT');
});
