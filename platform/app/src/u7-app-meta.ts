import type { U7ApiApp } from '@u7-scl/app-legacy/domain';
import type { AppMeta } from '@u7-scl/core/domain';
import type { CourseApiModuleMeta } from '@u7-scl/course/domain';
import type { PeerReviewApiModuleMeta } from '@u7-scl/peer-review/domain';
import type { QuestionnaireApiModuleMeta } from '@u7-scl/questionnaire/domain';
import type { StreamApiModuleMeta } from '@u7-scl/stream';
import type { UserApiModuleMeta } from '@u7-scl/user/domain';

/**
 * Метаданные legacy API-приложения U7 Bot.
 */
export interface U7BotAppMeta extends AppMeta {
  name: 'u7-bot-app';
  moduleMetas:
    | UserApiModuleMeta
    | StreamApiModuleMeta
    | CourseApiModuleMeta
    | QuestionnaireApiModuleMeta
    | PeerReviewApiModuleMeta;
}

/** Тип API-приложения U7 бота (актор закрыт на User в модуле app) */
export type U7BotApp = U7ApiApp<U7BotAppMeta>;
