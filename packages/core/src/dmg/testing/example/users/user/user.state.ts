import * as v from 'valibot';
import { BaseEntityFields, F } from '../../../../kernel/fields/fields';

/** Entity пользователя — единственное место структуры состояния. */
export const UserState = v.object({
  ...BaseEntityFields,
  status: F.picklist(['active', 'removed'], 'Статус учётной записи'),
});

export type UserState = v.InferOutput<typeof UserState>;
