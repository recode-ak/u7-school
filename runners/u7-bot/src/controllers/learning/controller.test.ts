import { describe, expect, test } from 'bun:test';
import { LearningController } from './controller';

describe('LearningController', () => {
  test('стори имеют уникальные имена', () => {
    const ctrl = new LearningController();
    const stories = ctrl.getStories();
    const names = stories.map((s) => s.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
