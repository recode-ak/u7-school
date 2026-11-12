import { DossierModuleDef } from '@u7-scl/domain/dossier/contract';
import type { Identified } from 'dmg-core';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';

/**
 * Резолвер модуля: платформа и фасады `dependsOn`; своих репозиториев у
 * модуля-заготовки нет.
 */
export type DossierDeps = ModuleDeps;

/** Карта «Def → класс» модуля dossier (API-05): исполнять нечего. */
export const dossierMap = {
  useCases: {},
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof DossierModuleDef, DossierDeps, Identified>;

/** Модуль dossier с зависимостями — для сборки приложения. */
export function createDossierModule(deps: DossierDeps) {
  return new ModuleFromDef<typeof DossierModuleDef, DossierDeps, Identified>(
    DossierModuleDef,
    dossierMap,
    deps,
  );
}
