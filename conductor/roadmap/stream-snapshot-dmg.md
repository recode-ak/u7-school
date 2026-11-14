# Снимок контента потока через домен — заготовка

**Назначение:** перевод `scripts/update-stream-snapshot.ts` и `scripts/stream-snapshot-sync.ts` на домен `stream` и UoW. Источник — F-80 ревизии (`revision-release_20261112`, TR-45); решение Нурболата 2026-11-14 — кандидат после релиза.

---

## 1. Что сейчас

- `update-stream-snapshot.ts` перечитывает `streams.json` и пишет его сырым JSON: без сверки `version`, без `updatedAt`. Запись бота между чтением и записью теряется — справка требует бэкап и остановленный бот.
- `stream-snapshot-sync.ts` держит доменные правила вне домена: кто из студентов «обогнал» вставленный шаг (`isStudentAheadOfStep`, `analyzeSnapshotDelta`) и зачёт шага задним числом (`syncAheadStudents`). Правила мутируют state студента напрямую.
- `students.json` уже пишется после строгого разбора `StudentArDef.state`.

## 2. Что сделать

1. Операции Ar: `StreamAr` — замена снимка контента (с версией и `updatedAt`); `StudentAr` — зачёт вставленного шага (без событий прогресса или с отдельным событием — решить в брифе).
2. Правило «обогнал вставленный шаг» — DCS потока и студентов (образец — `domain/src/stream/step-completion.dcs.ts`), тесты из `scripts/stream-snapshot-sync.test.ts` переезжают в домен (TST-08).
3. Запись — через `StreamJsonRepo`/`StudentJsonRepo` и UoW: либо UC модуля `stream` (`callers: ['system']`, вызов как `scripts/call-uc.ts`), либо скрипт с UoW напрямую. Выбор — в брифе; UC даёт запись в лог операций (D-73).
4. `dmg-data-keeper`: совместимость `streams.json`/`students.json`, сухой прогон на копии.

## 3. Границы

- Поведение для админа не меняется: интерактивный выбор потока, `--dry-run`, `--sync-students`, отчёт «было → стало».
- Живые `data/` — только по протоколу AGENTS.md (бэкап, подтверждение).
