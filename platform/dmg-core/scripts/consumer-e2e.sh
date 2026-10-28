#!/usr/bin/env bash
# Сквозная проверка пакета глазами потребителя — будущий CI репозитория
# dmg-core. Запуск из корня пакета с установленными зависимостями:
#
#   bun run e2e
#
# 1. npm publish --dry-run без исправлений package.json; состав tarball.
# 2. Установка tarball в пустой проект → импорт и ArchChecker.
# 3. dmg-core init → sync --check; документация, скилы и ссылки на месте
#    (consumer-check.ts); biome потребителя загружает плагины пакета.
# 4. gen создаёт модуль, тесты заготовок зелёные на установленном пакете.
# 5. Профили single и monorepo: init --profile → gen module/aggregate/uc →
#    подключение по подсказкам (consumer-wire.ts) → раннер вызывает UC →
#    bun run check проекта зелёный.
set -euo pipefail

PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "e2e: npm publish --dry-run"
PUBLISH="$(cd "$PKG" && npm publish --dry-run 2>&1)"
if grep -q 'errors corrected' <<<"$PUBLISH"; then
  grep 'warn publish' <<<"$PUBLISH" >&2
  echo "e2e: npm исправил бы package.json при публикации" >&2
  exit 1
fi
for field in license author; do
  if [ "$(jq -r ".$field // empty" "$PKG/package.json")" = "" ]; then
    echo "e2e: в package.json нет $field" >&2
    exit 1
  fi
done

echo "e2e: bun pm pack и состав tarball"
(cd "$PKG" && bun pm pack --destination "$WORK" >/dev/null)
TARBALL="$(ls "$WORK"/dmg-core-*.tgz)"
FILES="$(tar -tzf "$TARBALL")"
for need in LICENSE llms.txt README.md docs/index.md docs/rules.md \
  skills/dmg-architecture/SKILL.md agents/README.md \
  biome-plugins/dom-14-no-clock.grit src/index.ts src/cli/main.ts; do
  if ! grep -qx "package/$need" <<<"$FILES"; then
    echo "e2e: в tarball нет $need" >&2
    exit 1
  fi
done
# Тесты в поставке — только учебного модуля (образец для гайдов).
EXTRA="$(grep -E '^package/(scripts|lint-fixtures|node_modules)|\.test\.ts$' <<<"$FILES" |
  grep -v '^package/src/testing/example/' || true)"
if [ -n "$EXTRA" ]; then
  echo "e2e: лишнее в tarball:" >&2
  echo "$EXTRA" >&2
  exit 1
fi

echo "e2e: установка tarball в пустой проект"
mkdir "$WORK/consumer"
cd "$WORK/consumer"
cat >package.json <<JSON
{ "name": "consumer", "private": true, "type": "module" }
JSON
bun add "$TARBALL" valibot @valibot/to-json-schema >/dev/null
cat >smoke.ts <<'TS'
import { ArchChecker } from 'dmg-core/arch';
import { ExampleArch } from 'dmg-core/testing';

const violations = ArchChecker.of(ExampleArch).check();
if (violations.length > 0) {
  console.error(violations);
  process.exit(1);
}
console.log('consumer: dmg-core импортируется, ArchChecker чист');
TS
bun run smoke.ts

echo "e2e: init и документация в проекте-потребителе"
bunx dmg-core init
bunx dmg-core sync --check
bun "$PKG/scripts/consumer-check.ts" "$WORK/consumer"

echo "e2e: biome потребителя загружает плагины пакета"
bun add -d "@biomejs/biome@$(jq -r '.devDependencies["@biomejs/biome"]' "$PKG/package.json")" >/dev/null
mkdir -p lint
echo 'export const at = Date.now();' >lint/clock.ts
cat >biome.json <<'JSON'
{
  "files": { "includes": ["lint/**"] },
  "overrides": [
    {
      "includes": ["lint/**"],
      "plugins": ["./node_modules/dmg-core/biome-plugins/dom-14-no-clock.grit"]
    }
  ]
}
JSON
# biome с найденным нарушением выходит с кодом 1 — это ожидаемо.
LINT="$(bunx biome lint --reporter=json lint 2>/dev/null || true)"
if ! grep -q 'DOM-14:' <<<"$LINT"; then
  echo "e2e: плагин DOM-14 из node_modules/dmg-core не сработал" >&2
  exit 1
fi
rm -r lint biome.json

echo "e2e: gen на установленном пакете"
bunx dmg-core gen module todo --write >/dev/null
bunx dmg-core gen aggregate todo.task --write >/dev/null
bunx dmg-core gen uc todo.task complete-task --write >/dev/null
bun test src

# Проект по профилю с нуля: пакет из tarball, каркас, срез gen, ручное
# подключение модуля, вызов UC раннером, полный check проекта.
# Красный шаг: хвост лога и выход.
run_logged() {
  local log="$1" what="$2"
  shift 2
  if ! "$@" >"$log" 2>&1; then
    tail -40 "$log" >&2
    echo "e2e: $what" >&2
    exit 1
  fi
}

# Имя проекта со scope (`@acme/school`) проверяет вывод scope пакетов
# monorepo из имени — как в README.
profile_e2e() {
  local profile="$1" main="$2" name="$3"
  local dir="$WORK/$profile" scope="${3#@}"
  scope="${scope%%/*}"
  echo "e2e: профиль $profile ($name)"
  mkdir "$dir"
  cd "$dir"
  echo "{ \"name\": \"$name\" }" >package.json
  bun add "$TARBALL" >/dev/null
  bunx dmg-core init --profile "$profile" >/dev/null
  bun install >/dev/null
  run_logged "$WORK/$profile-init-check.log" \
    "$profile — bun run check красный сразу после init" bun run check
  bunx dmg-core gen module todo --write >/dev/null
  bunx dmg-core gen aggregate todo.task --write >/dev/null
  bunx dmg-core gen uc todo.task complete-task --write >/dev/null
  bun "$PKG/scripts/consumer-wire.ts" "$dir" "$profile" "$scope"
  bun install >/dev/null
  run_logged "$WORK/$profile-format.log" "$profile — bun run format упал" \
    bun run format
  local out
  out="$(APP_DATA_DIR=data bun "$main" complete-task)"
  if [ "$out" != '{"ok":true,"value":{}}' ]; then
    echo "e2e: $profile — раннер вернул $out" >&2
    exit 1
  fi
  if ! grep -q '"op":"completeTask"' data/oplog/*.jsonl; then
    echo "e2e: $profile — нет записи completeTask в oplog" >&2
    exit 1
  fi
  run_logged "$WORK/$profile-check.log" "$profile — bun run check красный" \
    bun run check
}

profile_e2e single src/runner/main.ts acme
profile_e2e monorepo runners/cli/src/main.ts @acme/school
echo "e2e: ok"
