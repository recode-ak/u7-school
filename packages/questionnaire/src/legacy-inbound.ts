import type { LegacyInbound } from '@u7-scl/core/legacy-bridge';
import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';

/**
 * Перевод legacy-события анкеты в payload Def: данные владельца лежат в
 * legacy-событии вне payload (`ownerInfo`), в Def — поле `owner`.
 */
const withOwner: NonNullable<LegacyInbound['payload']> = (event) => ({
  ...event.payload,
  owner: 'ownerInfo' in event ? event.ownerInfo : undefined,
});

/**
 * Входящие legacy-события модуля questionnaire (D-37): имя в legacy-шине →
 * Def из контракта внешнего модуля. Лишние поля legacy-payload (например,
 * `telegramId` от SweepAbandonedJob) отбрасывает схема Def. Уйдёт при
 * миграции модуля — события будет публиковать DMG-агрегат.
 */
export const questionnaireLegacyInbound: readonly LegacyInbound[] = [
  {
    legacy: 'questionnaire:complete',
    def: QuestionnaireEvents.completed,
    payload: withOwner,
  },
  {
    legacy: 'questionnaire:abandon',
    def: QuestionnaireEvents.abandoned,
    payload: withOwner,
  },
];
