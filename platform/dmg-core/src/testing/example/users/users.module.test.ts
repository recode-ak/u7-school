import { describe, expect, it } from 'bun:test';
import { checkDefs } from '#core/arch/check-defs';
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

  it('checkDefs — без нарушений', () => {
    expect(
      checkDefs(DefIndex.from([UsersModuleDef])).map((v) => v.format()),
    ).toEqual([]);
  });
});
