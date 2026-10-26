#!/usr/bin/env bash
# Проверка самодостаточности пакета dmg-core (трек dmg-core-extract, Ф3).
#
#   bun run extract:check
#
# 1. Копия пакета в пустой каталог → install → check (lint, tslint, тесты).
# 2. bun pm pack → установка tarball в пустой проект → импорт и archCheck.
# 3. В том же проекте: dmg-core init → sync --check; документация, скилы и
#    ссылки на месте (scripts/consumer-check.ts пакета); gen создаёт модуль,
#    тесты заготовок зелёные на установленном пакете.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="$ROOT/packages/dmg-core"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "extract:check: копия пакета → $WORK/copy"
mkdir "$WORK/copy"
tar -C "$PKG" --exclude=node_modules --exclude='*.tgz' --exclude='tmp-gen-e2e-*' -cf - . | tar -C "$WORK/copy" -xf -
(cd "$WORK/copy" && bun install && bun run check)

echo "extract:check: bun pm pack"
(cd "$WORK/copy" && bun pm pack --destination "$WORK" >/dev/null)
TARBALL="$(ls "$WORK"/dmg-core-*.tgz)"

echo "extract:check: установка tarball в пустой проект"
mkdir "$WORK/consumer"
cd "$WORK/consumer"
cat >package.json <<JSON
{ "name": "consumer", "private": true, "type": "module" }
JSON
bun add "$TARBALL" valibot @valibot/to-json-schema >/dev/null
cat >smoke.ts <<'TS'
import { archCheck } from 'dmg-core/arch';
import { ExampleArch } from 'dmg-core/testing';

const violations = archCheck(ExampleArch);
if (violations.length > 0) {
  console.error(violations);
  process.exit(1);
}
console.log('consumer: dmg-core импортируется, archCheck чист');
TS
bun run smoke.ts

echo "extract:check: init и документация в проекте-потребителе"
bunx dmg-core init
bunx dmg-core sync --check
bun "$WORK/copy/scripts/consumer-check.ts" "$WORK/consumer"

echo "extract:check: biome потребителя загружает плагины пакета"
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
  echo "extract:check: плагин DOM-14 из node_modules/dmg-core не сработал" >&2
  exit 1
fi
rm -r lint biome.json

echo "extract:check: gen на установленном пакете"
bunx dmg-core gen module todo --write >/dev/null
bunx dmg-core gen aggregate todo.task --write >/dev/null
bunx dmg-core gen uc todo.task complete-task --write >/dev/null
bun test src
echo "extract:check: ok"
