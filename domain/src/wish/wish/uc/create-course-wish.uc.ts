import { GetCourseEnrollmentUcDef } from '@u7-scl/domain/course/contract';
import { StartQuestionnaireUcDef } from '@u7-scl/domain/questionnaire/contract';
import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { WishArDef } from '../wish.ar';
import { WishErrors } from '../wish.errors';
import { WishRules } from '../wish.rules';
import { WishCourseTargetVo } from '../wish.state';

/**
 * Желание пройти курс — за вызывающего (`userId` — из субъекта, не из
 * входа), поэтому `allowAll` (см. `WishPolicy`). Порядок отказов — как
 * у legacy: сначала курс (`courseEnrollable`), затем дубль (`unique`).
 * У курса с пулом анкеты желание ждёт анкету — UC запускает её через
 * модуль анкет; событий создания желания нет.
 */
export const CreateCourseWishUcDef = UseCaseDef.define({
  name: 'createCourseWish',
  label: 'Выразить желание пройти курс',
  description:
    'Фиксирует желание пользователя пройти курс: сразу или после анкеты, если у курса есть пул анкеты.',
  type: 'command',
  aggregate: WishArDef,
  callers: ['user'],
  policy: allowAll,
  rules: [WishRules.rules.courseEnrollable, WishRules.rules.unique],
  calls: [GetCourseEnrollmentUcDef, StartQuestionnaireUcDef],
  input: v.object({ courseId: WishCourseTargetVo.entries.courseId }),
  output: v.object({
    outcome: F.picklist(
      ['instant', 'questionnaire'],
      'Исход: желание зафиксировано сразу или запущена анкета',
    ),
  }),
  errors: [WishErrors.COURSE_NOT_FOUND, WishErrors.ALREADY_EXISTS],
});
