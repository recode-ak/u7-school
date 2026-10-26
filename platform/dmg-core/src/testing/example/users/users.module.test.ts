import { describe, expect, it } from 'bun:test';
import { checkDefs } from '#core/arch/check-defs';
import { formatViolation } from '#core/arch/violation';
import { indexDefs } from '#core/graph/def-index';
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
    expect(checkDefs(indexDefs([UsersModuleDef])).map(formatViolation)).toEqual(
      [],
    );
  });
});
