/**
 * Вход `testing` модуля `stream` для тестов вне модуля (TST-07). Здесь —
 * только то, чего нет в контракте (`…/stream/contract`): формы записей
 * потока и студента на диске (`StreamStatus` — в контракте, не дублируется).
 */

/** Миры u7-bot: запись потока на диске (`streams.json`). */
export type { StreamState } from './stream/stream.state';
/** Миры u7-bot: запись студента на диске (`students.json`). */
export type { StudentState } from './student/student.state';
