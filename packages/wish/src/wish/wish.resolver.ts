// DEBT-22
import type { U7ModuleResolver } from '@u7-scl/app/domain';
import type { CourseFacade } from '@u7-scl/domain/course';
import type { QuestionnaireFacade } from '@u7-scl/domain/questionnaire';
import type { StreamFacade } from '@u7-scl/domain/stream';
import type { UserFacade } from '@u7-scl/domain/user';
import type { WishRepo } from './wish.repo';

/** Резолвер зависимостей API-модуля wish. */
export interface WishApiModuleResolver extends U7ModuleResolver {
  wishRepo: WishRepo;
  courseFacade: CourseFacade;
  streamFacade: StreamFacade;
  questionnaireFacade: QuestionnaireFacade;
  userFacade: UserFacade;
}
