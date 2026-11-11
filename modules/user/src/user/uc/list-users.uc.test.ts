import { beforeEach, describe, expect, it } from 'bun:test';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { expectOk } from 'dmg-core/testing';
import { ListUsersUc } from './list-users.uc';
import {
  asMember,
  MEMBER_ID,
  makeEnv,
  OTHER_ID,
  REQ,
  userState,
} from './user-uc.fixture';

// Перенос `api/user/list-users-uc.test.ts` (1). Логика фильтра — в тесте
// репозитория (TST-08): здесь только проброс входа и вид ответа.

let env: ReturnType<typeof makeEnv>;
const uc = () => new ListUsersUc(env.deps, UserModuleDef);

beforeEach(() => {
  env = makeEnv();
});

describe('ListUsersUc', () => {
  it('фильтр уходит в findAll как есть, ответ — UserView найденных', async () => {
    const ivan = userState({ name: 'Иван' });
    const maria = userState({ uuid: OTHER_ID, name: 'Мария', telegramId: 222 });
    env.seed(ivan, maria);
    const filter = {
      limit: 5,
      role: 'MENTOR',
      name: 'ив',
      telegramId: 111,
      sort: 'name:asc',
    } as const;

    const res = await uc().handle(filter, asMember, REQ);

    expect(env.asked.filters).toEqual([filter]);
    expect(expectOk(res).map((u) => u.uuid)).toEqual([MEMBER_ID, OTHER_ID]);
    expect(expectOk(res)[0]).toEqual(ivan);
  });

  it('пустой вход — limit 20 и сортировка createdAt:desc по умолчанию', async () => {
    expectOk(await uc().handle({}, asMember, REQ));

    expect(env.asked.filters).toEqual([{ limit: 20, sort: 'createdAt:desc' }]);
  });
});
