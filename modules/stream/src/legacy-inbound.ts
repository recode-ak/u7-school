import type { LegacyInbound } from '@u7-scl/core/legacy-bridge';
import { StreamEvents, StudentEvents } from '@u7-scl/domain/stream/contract';

/**
 * Входящие legacy-события модуля stream (D-37): имя в legacy-шине → Def из
 * контракта внешнего модуля. Payload legacy совпадает с Def по полям и
 * берётся как есть; лишние поля отбрасывает схема Def. Уйдёт при миграции
 * модуля — события будет публиковать DMG-агрегат.
 */
export const streamLegacyInbound: readonly LegacyInbound[] = [
  { legacy: 'student.enrolled', def: StudentEvents.enrolled },
  { legacy: 'student.completed', def: StudentEvents.completed },
  { legacy: 'student.abandoned', def: StudentEvents.abandoned },
  { legacy: 'stream.created', def: StreamEvents.created },
];
