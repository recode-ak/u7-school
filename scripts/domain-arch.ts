/**
 * Данные проверок домена для `bun run arch:check`: модули домена по Def и
 * путь к реестру долга `conductor/architecture/debt.md`.
 */
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { DossierModuleDef } from '@u7-scl/domain/dossier/contract';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review/contract';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { WishModuleDef } from '@u7-scl/domain/wish';
import type { AnyModuleDef } from 'dmg-core';

/**
 * Модули `@u7-scl/domain`: граф `dependsOn` строится из Def, Def проверяет
 * `checkDefs`. Каталог домена без модуля в списке — ARC-05
 * (`checkDomainDirs`).
 */
// DEBT-33: `archCheck` по модулям домена не подключён — ARC-04 платформы
// не знает подпути `/contract`, а внешние модули несут legacy-импорты
export const DOMAIN_MODULES: readonly AnyModuleDef[] = [
  UserModuleDef,
  CourseModuleDef,
  QuestionnaireModuleDef,
  StreamModuleDef,
  WishModuleDef,
  PeerReviewModuleDef,
  DossierModuleDef,
];

export const DEBT_MD = 'conductor/architecture/debt.md';
