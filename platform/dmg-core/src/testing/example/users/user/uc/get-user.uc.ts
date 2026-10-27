import * as v from 'valibot';
import { type OutputOf, UseCaseDef } from '#core/domain/contracts/use-case-def';
import { allowAll } from '#core/domain/policy/rule';
import { F } from '#core/kernel/fields/fields';
import { UserArDef } from '../user.ar';
import { UserErrors } from '../user.errors';
import { UserState } from '../user.state';

/**
 * Пользователь для других модулей (D-42, D-43): вызывается только системой
 * через фасад `users`. Выход — ответ на вопрос «активен ли», а не state:
 * решение о статусе учётной записи принимает `users` (`UserAr.isActive`),
 * вызывающий его только переводит в своё правило.
 */
export const GetUserUcDef = UseCaseDef.define({
  name: 'getUser',
  label: 'Пользователь',
  description:
    'Активна ли учётная запись пользователя — для других модулей; нет пользователя — USER_NOT_FOUND.',
  type: 'query',
  aggregate: UserArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({ userId: UserState.entries.uuid }),
  output: v.object({
    userId: UserState.entries.uuid,
    active: F.boolean('Учётная запись активна'),
  }),
  errors: [UserErrors.NOT_FOUND],
});

/** Ответ `users` об учётной записи — контекст правил вызывающих модулей. */
export type UserActivity = OutputOf<typeof GetUserUcDef>;
