import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { defineModule } from 'dmg-core';
import { CreateCourseWishUcDef } from './wish/uc/create-course-wish.uc';
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
    // gen:defs:useCases
  ],
  reactions: [
    // gen:defs:reactions
  ],
  jobs: [
    // gen:defs:jobs
  ],
});
