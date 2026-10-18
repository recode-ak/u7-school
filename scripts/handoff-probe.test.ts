import { describe, expect, test } from 'bun:test';
import { pluralRu } from './handoff-probe';

const forms: [string, string, string] = ['урок', 'урока', 'уроков'];

describe('pluralRu', () => {
  test('1, 21, 101 — первая форма', () => {
    expect([1, 21, 101].map((n) => pluralRu(n, forms))).toEqual([
      'урок',
      'урок',
      'урок',
    ]);
  });

  test('2–4, 22 — вторая форма', () => {
    expect([2, 3, 4, 22].map((n) => pluralRu(n, forms))).toEqual([
      'урока',
      'урока',
      'урока',
      'урока',
    ]);
  });

  test('0, 5–20, 111–114 — третья форма', () => {
    expect(
      [0, 5, 11, 12, 14, 20, 111, 114].map((n) => pluralRu(n, forms)),
    ).toEqual(Array(8).fill('уроков'));
  });
});
