import { describe, expect, test } from 'bun:test';
import { StreamApiModule } from './module';

// Оболочка legacy-модуля: UC, реакций и Job нет — всё в Def-модуле `stream`.
const module = new StreamApiModule({} as never);

describe('StreamApiModule (оболочка)', () => {
  test('имя модуля — stream', () => {
    expect(module.name).toBe('stream');
  });

  test('UC, реакций и Job в оболочке нет', () => {
    expect(module.useCases).toEqual([]);
    expect(module.reactions).toEqual([]);
    expect(module.jobs).toEqual([]);
  });
});
