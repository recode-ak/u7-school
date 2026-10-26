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

/** Шаблоны путей модуля из секции `gen` `dmg-core.json`; `{m}` — имя модуля */
export interface GenTemplates {
  domain: string;
  app: string;
}

/**
 * Приложение домена для `archCheck` по шаблонам генератора: один источник
 * путей с `dmg-core gen`. Функция, а не литерал — чтобы проверить подстановку
 * на произвольных шаблонах. Вход модуля для других — `contract.ts` (D-45).
 */
export function domainArchFor(gen: GenTemplates, root: string): ArchApp {
  const fill = (template: string, m: string) =>
    join(root, template.replaceAll('{m}', m));
  return {
    name: 'domain',
    modules: DOMAIN_MODULES,
    layout: (m) => ({ domain: fill(gen.domain, m), app: fill(gen.app, m) }),
    entry: 'contract',
  };
}

const config: { gen: GenTemplates } = await Bun.file(
  join(ROOT, 'dmg-core.json'),
).json();

/** Приложение домена проекта: пути — из `gen` `dmg-core.json` */
export const DomainArch: ArchApp = domainArchFor(config.gen, ROOT);

export const DEBT_MD = 'conductor/architecture/debt.md';
