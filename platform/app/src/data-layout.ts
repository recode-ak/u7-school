import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { DossierModuleDef } from '@u7-scl/domain/dossier/contract';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review/contract';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { WishModuleDef } from '@u7-scl/domain/wish/contract';

/** Модули приложения, чьи агрегаты хранятся в `DB_DIR` (у `dossier` агрегатов нет). */
export const DATA_MODULES = [
  UserModuleDef,
  CourseModuleDef,
  WishModuleDef,
  PeerReviewModuleDef,
  QuestionnaireModuleDef,
  StreamModuleDef,
  DossierModuleDef,
] as const;

/**
 * Раскладка каталога данных `DB_DIR`: где лежит каждый файл относительно него.
 * Единый источник путей для `U7App` (репозитории) и `DataDirAudit` (контрольное
 * чтение); ключи `DATA_FILES` — имена агрегатов из `*ModuleDef.aggregates`.
 */
export const DATA_FILES = {
  user: 'users/users.json',
  course: 'courses/courses.json',
  module: 'courses/modules.json',
  lesson: 'courses/lessons.json',
  step: 'courses/steps.json',
  wish: 'wish/wishes.json',
  questionnaire: 'questionnaires/questionnaires.json',
  'review-campaign': 'peer-review/campaigns.json',
  review: 'peer-review/reviews.json',
  stream: 'streams/streams.json',
  student: 'streams/students.json',
} as const satisfies Readonly<Record<string, string>>;

/** История прогонов заданий (`JobRunJsonRepo`) — не агрегат. */
export const JOB_RUNS_FILE = 'jobs/last-runs.json';

/** Каталог JSONL-лога операций DMG. */
export const OPLOG_DIR = 'oplog';
