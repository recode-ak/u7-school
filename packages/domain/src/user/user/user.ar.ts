import { BaseEntityFields, defineAggregate, defineErrors } from 'dmg-core';
import * as v from 'valibot';

/**
 * Def агрегата внешнего модуля (D-37): нужен Def UC модуля (`aggregate`).
 * Состояние, события и ошибки — пустой минимум; агрегат реализует legacy-код
 * (`UserAr`). При миграции модуля Def наполняется.
 */
export const UserArDef = defineAggregate({
  name: 'user',
  label: 'Пользователь',
  description: 'Учётная запись пользователя школы: профиль и роли.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: defineErrors('USER', {}),
});
