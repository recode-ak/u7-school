/**
 * Данные проверок домена для `bun run arch:check`: модули домена по Def,
 * приложение домена для `archCheck` и путь к реестру долга
 * `conductor/architecture/debt.md`.
 */
import { join } from 'node:path';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { DossierModuleDef } from '@u7-scl/domain/dossier/contract';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review/contract';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { WishModuleDef } from '@u7-scl/domain/wish/contract';
import type { AnyModuleDef } from 'dmg-core';
import type { ArchApp } from 'dmg-core/arch';

/**
 * Модули `@u7-scl/domain`: граф `dependsOn` строится из Def, Def проверяет
 * `checkDefs`. Каталог домена без модуля в списке — ARC-05
 * (`checkDomainDirs`).
 */
export const DOMAIN_MODULES: readonly AnyModuleDef[] = [
  UserModuleDef,
  CourseModuleDef,
  QuestionnaireModuleDef,
  StreamModuleDef,
  WishModuleDef,
  PeerReviewModuleDef,
  DossierModuleDef,
];

const ROOT = join(import.meta.dir, '..');

/**
 * Приложение домена для `archCheck`: домен — `packages/domain/src/<m>`,
 * прикладной слой — `packages/<m>/src`; вход модуля для других —
 * `contract.ts` (D-45).
 */
export const DomainArch: ArchApp = {
  name: 'domain',
  modules: DOMAIN_MODULES,
  layout: (m) => ({
    domain: join(ROOT, 'packages/domain/src', m),
    app: join(ROOT, 'packages', m, 'src'),
  }),
  entry: 'contract',
};

export const DEBT_MD = 'conductor/architecture/debt.md';
