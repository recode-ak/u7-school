/**
 * data-audit — строгое чтение всех файлов данных `DB_DIR` (по умолчанию `data`)
 * схемами state (`DataDirAudit`); только читает. Запуск перед выкаткой и после
 * правки данных: `DB_DIR=./data bun run data:audit`; код 1 — есть ошибки.
 */
import { DataDirAudit } from '@u7-scl/app';

const dbDir = process.env.DB_DIR ?? 'data';
const report = await new DataDirAudit(dbDir).run();
for (const f of report.files) {
  console.log(`${f.file}: ${f.missing ? 'нет файла' : `записей ${f.records}`}`);
}
for (const i of report.issues) {
  const at =
    i.index === undefined
      ? ''
      : ` → запись ${i.index}${i.uuid ? ` (${i.uuid})` : ''}`;
  console.error(`${i.file}${at}: ${i.message}`);
}
console.log(`Ошибок: ${report.issues.length}`);
process.exit(report.ok ? 0 : 1);
