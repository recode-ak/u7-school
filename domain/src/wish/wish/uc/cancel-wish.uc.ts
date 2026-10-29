import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { WishArDef } from '../wish.ar';
import { WishErrors } from '../wish.errors';
import { WishPolicy } from '../wish.policy';
import { WishRules } from '../wish.rules';
import { WishCourseTargetVo, WishModuleTargetVo } from '../wish.state';

const expectedVersion = F.expectedVersion('желания');

/**
 * Отмена желания: вход — цель (курс или модуль), желание ищется среди
 * желаний субъекта. Policy — автор желания (`canCancel`). «Нет желания»
 * и «желание не отменяемо» для вызывающего одинаково — `WISH_NOT_FOUND`:
 * отсутствие агрегата — отказ загрузки (`load`), неотменяемое состояние —
 * доменное правило `cancellable` (после Policy). Событий отмены нет.
 */
export const CancelWishUcDef = UseCaseDef.define({
  name: 'cancelWish',
  label: 'Отменить желание',
  description:
    'Отменяет текущее желание пользователя на курс или модуль: выраженное или подтверждённое.',
  type: 'command',
  aggregate: WishArDef,
  callers: ['user'],
  policy: WishPolicy.rules.canCancel,
  rules: [WishRules.rules.cancellable],
  input: v.pipe(
    v.variant('kind', [
      v.object({ ...WishCourseTargetVo.entries, expectedVersion }),
      v.object({ ...WishModuleTargetVo.entries, expectedVersion }),
    ]),
    v.description('Цель желания и ожидаемая версия желания'),
  ),
  output: v.object({}),
  // NOT_CANCELLABLE через UC недостижим: правило `cancellable` срабатывает
  // раньше (→ NOT_FOUND). В `errors` — по ERR-02: её пробрасывает переход Ar.
  errors: [WishErrors.NOT_FOUND, WishErrors.NOT_CANCELLABLE],
});
