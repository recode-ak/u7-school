import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { defineModule } from 'dmg-core';
import { AbandonWishErDef } from './wish/er/abandon-wish.er';
import { ConfirmWishErDef } from './wish/er/confirm-wish.er';
import { FulfillWishErDef } from './wish/er/fulfill-wish.er';
import { CancelWishUcDef } from './wish/uc/cancel-wish.uc';
import { CreateCourseWishUcDef } from './wish/uc/create-course-wish.uc';
import { CreateModuleWishUcDef } from './wish/uc/create-module-wish.uc';
import { ListUserWishesUcDef } from './wish/uc/list-user-wishes.uc';
import { WishArDef } from './wish/wish.ar';
// gen:defs:imports

/**
 * Паспорт модуля желаний. Legacy-мета `module.ts` (`WishApiModuleMeta`)
 * живёт рядом до Ф12 (TR-9).
 */
export const WishModuleDef = defineModule({
  name: 'wish',
  label: 'Желания',
  description:
    'Желания пользователей пройти курс или модуль: фиксация сразу или после анкеты, отмена и реализация зачислением на поток.',
  dependsOn: [
    UserModuleDef,
    CourseModuleDef,
    QuestionnaireModuleDef,
    StreamModuleDef,
  ],
  aggregates: [
    WishArDef,
    // gen:defs:aggregates
  ],
  useCases: [
    CreateCourseWishUcDef,
    CreateModuleWishUcDef,
    CancelWishUcDef,
    ListUserWishesUcDef,
    // gen:defs:useCases
  ],
  reactions: [
    FulfillWishErDef,
    ConfirmWishErDef,
    AbandonWishErDef,
    // gen:defs:reactions
  ],
  jobs: [
    // gen:defs:jobs
  ],
});
