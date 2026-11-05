# Summary: tst-cleanup_20261105

## Базовая линия

Ветка от `816908b1`, 2026-11-05. `bun test` по каталогу (в worktree нужен `bun run seed:fixtures`, иначе 2 падения фикстур peer-review).

| Модуль | `domain/src/<m>` | `modules/<m>` |
|---|---|---|
| wish | 213 | 135 |
| stream | 416 | 226 |
| questionnaire | 213 | 113 |
| peer-review | 184 | 141 |
| user | 56 | 103 |
| dossier | 14 | 0 |

Тесты бота по модулям — в Ф2 при чистке модуля.

## DeepSeek

| Фаза | Шаг (`--label`) | Модель | $ | Ходы | hitRate | Круги доработок |
|---|---|---|---|---|---|---|
