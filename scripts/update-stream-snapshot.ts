/**
 * update-stream-snapshot — обновляет контент потока из актуального модуля курса (F-80).
 *
 * Работает через UC `stream`: `previewStreamContentSync` (отчёт, ничего не
 * пишет) → подтверждение → `syncStreamContent` (поток и прогресс студентов
 * пишет UoW модуля, скрипт файлов данных не трогает).
 *
 * Использование:
 *   bun run scripts/update-stream-snapshot.ts              # интерактивный выбор потока
 *   bun run scripts/update-stream-snapshot.ts <streamId>   # конкретный поток
 *   bun run scripts/update-stream-snapshot.ts [<streamId>] --dry-run   # только отчёт
 *
 * Потоки — в статусе набора (`enrollment`) и идущие (`active`). Каталог данных —
 * `DB_DIR` (по умолчанию `data`). Студентам, ушедшим вперёд от новых шагов,
 * шаги зачитываются задним числом: их список `affected` показан в отчёте и
 * подтверждается целиком. Версия потока из предпросмотра защищает от записи
 * бота между отчётом и применением (отказ — повторите запуск).
 *
 * ⚠️ Перед запуском на живых данных: остановить бота (`pm2 stop u7-school-bot`)
 * и сделать `bun run backup`; реакции модулей на событие обновления
 * запускаются, как в боте.
 */
import type { StreamView } from '@u7-scl/domain/stream/contract';
import {
  type ContentSyncPlan,
  ListStreamsUcDef,
  PreviewStreamContentSyncUcDef,
  StreamModuleDef,
  SyncStreamContentUcDef,
} from '@u7-scl/domain/stream/contract';
import { ScriptApp, type UcRejection } from './_app';
import { warnOnlyLogger } from './_course-client';

/** Ввод-вывод скрипта: подменяется в тестах. */
export interface SyncIo {
  log(line: string): void;
  error(line: string): void;
  /** Вопрос оператору; `null` — ввода нет. */
  prompt(question: string): string | null;
}

const consoleIo: SyncIo = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
  prompt: (question) => prompt(question),
};

/** Статусы потока, контент которых обновляется. */
const SYNCABLE = ['enrollment', 'active'] as const;

/** Отказы, означающие, что поток изменился между предпросмотром и применением. */
const STALE_CODES = ['VERSION_CONFLICT', 'SYNC_NEEDS_CONFIRMATION'];

const short = (id: string) => id.slice(0, 8);

/** Отказ UC → сообщение оператору. */
export function describeRejection(error: UcRejection): string {
  const text = `${error.code}: ${error.label}`;
  return STALE_CODES.includes(error.code)
    ? `${text}\n   Поток изменился с момента предпросмотра — запусти скрипт заново.`
    : text;
}

/** Печать плана: diff по ключам, студенты, блокеры. */
export function renderPlan(plan: ContentSyncPlan): string[] {
  const lines: string[] = [`Режим: ${plan.mode}`];
  const { projects, lessons, steps } = plan.diff;
  if (!plan.diff.changed) {
    lines.push('Контент не изменился.');
  } else {
    lines.push('Различия контента:');
    for (const p of projects.added) lines.push(`  + проект «${p.title}»`);
    for (const p of projects.removed) lines.push(`  - проект «${p.title}»`);
    for (const p of projects.renamed)
      lines.push(`  ~ проект «${p.from}» → «${p.to}»`);
    for (const l of lessons.added) lines.push(`  + урок «${l.title}»`);
    for (const l of lessons.removed) lines.push(`  - урок «${l.title}»`);
    for (const l of lessons.renamed)
      lines.push(`  ~ урок «${l.from}» → «${l.to}»`);
    for (const s of steps.added)
      lines.push(`  + шаг #${s.index} ${short(s.stepId)}`);
    for (const s of steps.removed)
      lines.push(`  - шаг #${s.index} ${short(s.stepId)}`);
    for (const s of steps.moved)
      lines.push(
        `  → шаг ${short(s.stepId)}: #${s.from.index} → #${s.to.index}`,
      );
  }
  if (plan.students.length > 0) {
    lines.push(`Студенты (${plan.students.length}):`);
    for (const s of plan.students) {
      const parts = [
        `${s.kind === 'not_started' ? 'не начал' : 'идёт'}`,
        `behind ${s.behind.length}`,
        `ahead ${s.ahead.length}`,
      ];
      if (s.tail) parts.push(`tail ${short(s.tail)}`);
      if (s.completedAhead.length > 0)
        parts.push(`completedAhead ${s.completedAhead.length}`);
      if (s.removedPassed.length > 0)
        parts.push(`removedPassed ${s.removedPassed.length}`);
      if (s.removesCurrent) parts.push('УДАЛЯЕТСЯ ТЕКУЩИЙ ШАГ');
      lines.push(`  ${short(s.userId)} (${s.status}): ${parts.join(', ')}`);
    }
  }
  lines.push(`Шаги будут зачтены студентам: ${plan.affected.length}`);
  for (const b of plan.blockers) {
    if (b.code === 'CONTENT_NOT_SYNCABLE') {
      lines.push('БЛОКЕР: поток не в статусе набора или идущего.');
    } else {
      lines.push(
        `БЛОКЕР: удаляется текущий шаг у студентов: ${b.students
          .map((s) => short(s.userId))
          .join(', ')}`,
      );
    }
  }
  return lines;
}

/** Выбор потока: по аргументу или интерактивно. `exit` — пустой ввод, `undefined` — ошибка. */
async function chooseStream(
  streams: StreamView[],
  explicitId: string | undefined,
  io: SyncIo,
): Promise<StreamView | 'exit' | undefined> {
  if (explicitId !== undefined) {
    const found = streams.find((s) => s.uuid === explicitId);
    if (!found) {
      io.error(
        `❌ Поток ${explicitId} не найден среди потоков в наборе и идущих.`,
      );
      for (const s of streams) io.log(`   ${s.uuid}  ${s.title} (${s.status})`);
    }
    return found;
  }
  io.log('Потоки:\n');
  streams.forEach((s, i) => {
    io.log(`  [${i + 1}] ${s.title}  (${s.status})  ${s.uuid}`);
  });
  const input = io.prompt('Выбери номер потока (или Enter — выйти):');
  if (!input?.trim()) return 'exit';
  const found = /^\d+$/.test(input.trim())
    ? streams[Number.parseInt(input.trim(), 10) - 1]
    : undefined;
  if (!found) io.error(`❌ Нет потока с номером «${input.trim()}».`);
  return found;
}

/** Запуск скрипта; возвращает код выхода. */
export async function run(
  argv: string[],
  dbDir: string = process.env.DB_DIR ?? 'data',
  io: SyncIo = consoleIo,
): Promise<number> {
  const unknown = argv.filter((a) => a.startsWith('--') && a !== '--dry-run');
  if (unknown.length > 0) {
    io.error(
      `❌ Неизвестный флаг: ${unknown.join(', ')}. Допустим только --dry-run.`,
    );
    return 1;
  }
  const dryRun = argv.includes('--dry-run');
  const explicitId = argv.find((a) => !a.startsWith('--'));

  const app = await ScriptApp.create({ dbDir, logger: warnOnlyLogger });

  const streams: StreamView[] = [];
  for (const status of SYNCABLE) {
    const res = await app.run(StreamModuleDef, ListStreamsUcDef, { status });
    if (!res.ok) {
      io.error(`❌ ${describeRejection(res.error)}`);
      return 1;
    }
    streams.push(...res.value);
  }
  if (streams.length === 0) {
    io.log('Потоки в наборе или идущие не найдены.');
    return 0;
  }

  const stream = await chooseStream(streams, explicitId, io);
  if (stream === 'exit') return 0;
  if (!stream) return 1;

  const preview = await app.run(
    StreamModuleDef,
    PreviewStreamContentSyncUcDef,
    {
      streamId: stream.uuid,
    },
  );
  if (!preview.ok) {
    io.error(`❌ ${describeRejection(preview.error)}`);
    return 1;
  }
  const { plan, streamVersion } = preview.value;

  io.log(`\n🔄 Поток «${stream.title}» (${stream.uuid}, v${streamVersion})`);
  for (const line of renderPlan(plan)) io.log(line);

  if (plan.blockers.length > 0) {
    io.error('\n❌ Обновление невозможно: устрани блокеры.');
    return 1;
  }
  if (!plan.diff.changed) return 0;
  if (dryRun) {
    io.log('\n🔍 DRY-RUN: данные НЕ изменены.');
    return 0;
  }

  const answer = io.prompt('\nПрименить обновление? [y/N]:');
  if (answer?.trim().toLowerCase() !== 'y') {
    io.log('Отменено.');
    return 0;
  }

  const sync = await app.run(StreamModuleDef, SyncStreamContentUcDef, {
    streamId: stream.uuid,
    confirmedStudentIds: plan.affected,
    expectedVersion: streamVersion,
  });
  if (!sync.ok) {
    io.error(`❌ ${describeRejection(sync.error)}`);
    return 1;
  }
  const credited = sync.value.credited.reduce(
    (sum, c) => sum + c.stepIds.length,
    0,
  );
  io.log(
    `✅ Готово (${sync.value.mode}): зачтено шагов ${credited} у ${sync.value.credited.length} студентов.`,
  );
  return 0;
}

if (import.meta.main) {
  run(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('❌ Ошибка:', err.message || err);
      process.exit(1);
    });
}
