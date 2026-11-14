Трек `revision-release_20261112`, Ф5.6. Бриф: `conductor/tracks/revision-release_20261112/slices/f5-6-domain.md` — прочитай целиком. Загрузи скилл `dmg-architecture`.

Выполни все строки брифа: F-70, F-71, F-72, F-73, F-74.

Отдельные поручения (не пропускать, это не ослабление):
- F-70: перенести кейсы `findCurrentByUserAndTarget` из `modules/wish/src/infra/wish.json-repo.test.ts` в `domain/src/wish/wish/wish.ar.test.ts` (`describe('currentOf')`), из json-repo-теста удалить.
- F-70: в `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:131-135` перевести подмену на `findAllByUserAndTarget`.
- F-73: тесты репозиториев peer-review на дубль ключа — ожидать `VersionConflict`.

Не трогай: `conductor/`, `data/`, `node_modules/`, репо `dmg-core`, модули и контракты вне брифа. Не коммить. Нужно изменить контракт сверх брифа — эскалация в отчёте.

Работай экономно: читай связанные файлы одним вызовом, не перечитывай прочитанное; во время работы — узкие проверки (`bun test <файл>`, `bunx tsc --noEmit -p <пакет>`), полный гейт `bun run scripts/agent-gate.ts` — один раз в конце.

Готово — раздел «Готово» брифа (все grep-критерии). Не ослабляй типы ради тестов; тест кажется неверным — не правь, опиши.

Отчёт: файлы; отклонения с причиной; тестов до/после в затронутых файлах; итог гейта; эскалации.
