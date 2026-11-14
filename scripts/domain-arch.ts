/**
 * Данные проверок домена для `bun run arch:check`: модули домена по Def,
 * приложение домена для `ArchChecker` и путь к реестру долга
 * `conductor/architecture/debt.md`.
 */
import { readdirSync } from 'node:fs';
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
import { GenLayout } from 'dmg-core/gen';

/**
 * Модули `@u7-scl/domain`: граф `dependsOn` строится из Def, Def проверяет
 * `DefChecker`. Каталог домена без модуля в списке — ARC-05
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
const layout = await GenLayout.read(ROOT);

/** Код раннеров — `src` каждого `runners/*`, по алфавиту (ARC-08). */
const RUNNERS = readdirSync(join(ROOT, 'runners'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(ROOT, 'runners', d.name, 'src'))
  .sort();

/**
 * Приложение домена проекта: пути модулей — из секции `gen` `dmg-core.json`
 * через `GenLayout`, один источник с `dmg-core gen`. Вход модуля для других —
 * `contract.ts` (D-45). Корень сборки — `@u7-scl/app` (ARC-07), раннеры —
 * `runners/*` (ARC-08, D-52); тесты вне `src` (`tests/`) не проверяются.
 */
export const DomainArch: ArchApp = {
  name: 'domain',
  modules: DOMAIN_MODULES,
  layout: (m) => layout.module(m),
  entry: 'contract',
  root: join(ROOT, 'platform/app/src'),
  runners: RUNNERS,
};

export const DEBT_MD = 'conductor/debt/code.md';
