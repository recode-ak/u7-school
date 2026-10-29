// TR-11: DMG-модуль внешнего контракта потоков — адаптеры над legacy-фасадом.
import type { StreamFacade } from '@u7-scl/domain/stream/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Identified } from 'dmg-core';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { GetStreamMembersUc } from './stream/uc/get-stream-members.uc';
import { GetStreamPresenceUc } from './stream/uc/get-stream-presence.uc';

/** Что адаптеры TR-11 берут у legacy-фасада потоков. */
export type StreamLegacy = Pick<StreamFacade, 'getStream' | 'getMembers'>;

/** Резолвер DMG-модуля потоков: платформа + legacy-фасад (TR-11). */
export type StreamModuleDeps = ModuleDeps & { readonly legacy: StreamLegacy };

/** Карта «Def → класс» внешнего модуля потоков (API-05); ER и Job нет. */
export const streamModuleMap = {
  useCases: {
    getStreamPresence: GetStreamPresenceUc,
    getStreamMembers: GetStreamMembersUc,
  },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof StreamModuleDef, StreamModuleDeps, Identified>;

/**
 * DMG-модуль потоков — владелец UC внешнего контракта; фасад для других
 * модулей — `new ModuleFacade(createStreamModule(deps))` (D-43).
 */
export function createStreamModule(deps: StreamModuleDeps) {
  return new ModuleFromDef<
    typeof StreamModuleDef,
    StreamModuleDeps,
    Identified
  >(StreamModuleDef, streamModuleMap, deps);
}
