import { describe, expect, it } from 'bun:test';
import { ArchChecker } from '#core/arch/arch-checker';
import { DefIndex } from '#core/graph/def-index';
import { normalize } from '#core/graph/normalize';
import { UsersModuleDef } from './users.module';

describe('UsersModuleDef', () => {
  it('паспорт: без зависимостей, UC удаления и ответа для других модулей', () => {
    expect(normalize(UsersModuleDef)).toMatchObject({
      dependsOn: [],
      aggregates: ['user'],
      useCases: ['removeUser', 'getUser'],
      reactions: [],
      jobs: [],
    });
  });

  it('ArchChecker — без нарушений', () => {
    expect(
      new ArchChecker(DefIndex.from([UsersModuleDef]))
        .check()
        .map((v) => v.format()),
    ).toEqual([]);
  });
});
