#!/usr/bin/env bash
# Проверка самодостаточности пакета dmg-core (трек dmg-core-extract, Ф3).
#
#   bun run extract:check
#
# 1. Копия пакета в пустой каталог → install → check (lint, tslint, тесты).
# 2. bun pm pack → установка tarball в пустой проект → импорт и archCheck.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="$ROOT/packages/dmg-core"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "extract:check: копия пакета → $WORK/copy"
mkdir "$WORK/copy"
tar -C "$PKG" --exclude=node_modules --exclude='*.tgz' -cf - . | tar -C "$WORK/copy" -xf -
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
import { archCheck } from 'dmg-core';
import { ExampleArch } from 'dmg-core/testing';

const violations = archCheck(ExampleArch);
if (violations.length > 0) {
  console.error(violations);
  process.exit(1);
}
console.log('consumer: dmg-core импортируется, archCheck чист');
TS
bun run smoke.ts
echo "extract:check: ok"
