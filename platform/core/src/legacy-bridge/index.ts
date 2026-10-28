// Мосты между платформой DMG и legacy-слоями: DMG о legacy не знает.
// Уйдёт вместе с legacy (conductor/architecture/legacy.md §6).

export { legacyClock } from './legacy-clock';
export {
  type LegacyEventBusOptions,
  type LegacyInbound,
  legacyEventBus,
} from './legacy-event-bus';
export { legacyJob, legacyJobsOf } from './legacy-job';
