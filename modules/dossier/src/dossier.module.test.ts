import { describe, expect, it } from 'bun:test';
import { DossierModuleDef } from '@u7-scl/domain/dossier/contract';
import { ModuleFacades } from 'dmg-core/app';
import { testAppContext } from 'dmg-core/testing';
import { createDossierModule } from './dossier.module';

describe('createDossierModule', () => {
  const { app } = testAppContext();
  const module = createDossierModule({ app, facades: new ModuleFacades([]) });

  it('собирается без репозиториев и держит Def модуля', () => {
    expect(module.def).toBe(DossierModuleDef);
  });

  it('состав: UC, ER и Job нет', () => {
    expect(module.def.useCases).toEqual([]);
    expect(module.def.reactions).toEqual([]);
    expect(module.def.jobs).toEqual([]);
  });
});
