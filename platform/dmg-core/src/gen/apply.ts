/** Применение плана: сначала всё проверяем, затем пишем; перезаписей нет. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { GenError } from './cli';
import { ImportBlock } from './import-block';
import { isImportSource } from './import-order';
import { PackageManifest } from './package-manifest';
import type {
  ApplyResult,
  GenPlan,
  HintedEdit,
  PlannedDependency,
  PlannedEdit,
  PlannedFile,
} from './plan';

/**
 * В режиме adopt существующие не перезаписываются: входы модуля (D-45) и
 * манифесты пакета модуля (`gen.package`) — их пишет проект при переводе.
 * Пропуск — по имени файла: под него попадает любой файл плана с таким
 * именем, какой бы вид его ни создал.
 */
const ENTRY_FILES = [
  'index.ts',
  'contract.ts',
  'package.json',
  'tsconfig.json',
];

/** Строка — маркер генератора (`// gen:*`). */
const isMarker = (line: string) => line.trim().startsWith('// gen:');

const indentOf = (line: string) => line.length - line.trimStart().length;

/**
 * Свой блок маркера: непрерывные строки над ним с отступом не меньше
 * маркерного, до предыдущего маркера. Здесь ищется уже вставленная строка:
 * такая же строка в чужом блоке (репозиторий `task` другого модуля) — не
 * повод пропустить вставку.
 */
function blockAbove(lines: readonly string[], marker: number): string[] {
  const indent = indentOf(lines[marker] ?? '');
  let start = marker;
  while (start > 0) {
    const line = lines[start - 1] ?? '';
    if (isMarker(line) || indentOf(line) < indent) break;
    start--;
  }
  return lines.slice(start, marker);
}

/** Итог правки одного маркера. */
type EditResult =
  | { text: string }
  | { skipped: 'present' }
  | { hint: string | undefined };

/**
 * Правка одного маркера. Импорт или реэкспорт встаёт в блок над маркером
 * по правилам biome (`ImportBlock`), прочее — прямо перед маркером, если
 * его ещё нет в своём блоке (`blockAbove`).
 */
function insertBeforeMarker(text: string, edit: PlannedEdit): EditResult {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.trim() === edit.marker);
  if (at === -1) return { hint: undefined };
  if (isImportSource(edit.line)) {
    const result = ImportBlock.above(lines, at).insert(edit.line);
    if (result.kind === 'present') return { skipped: 'present' };
    if (result.kind === 'conflict') {
      return {
        hint: `имя ${result.name} уже импортировано из '${result.from}' — нужен алиас`,
      };
    }
    return { text: lines.join('\n') };
  }
  const block = blockAbove(lines, at);
  const present = edit.line.includes('\n')
    ? block.join('\n').includes(edit.line)
    : block.some((l) => l.trim() === edit.line.trim());
  if (present) return { skipped: 'present' };
  lines.splice(at, 0, edit.line);
  return { text: lines.join('\n') };
}

export function applyPlan(
  plan: GenPlan,
  options: { write: boolean; adopt?: boolean },
): ApplyResult {
  const all = plan.files.map((f) => f.path);
  const dupes = all.filter((path, i) => all.indexOf(path) !== i);
  if (dupes.length > 0) {
    throw new GenError(`Файл дважды в плане: ${dupes.join(', ')}`);
  }
  const skipped: PlannedFile[] = options.adopt
    ? plan.files.filter(
        (f) => ENTRY_FILES.includes(basename(f.path)) && existsSync(f.path),
      )
    : [];
  const files = plan.files.filter((f) => !skipped.includes(f));
  const paths = files.map((f) => f.path);
  const taken = paths.filter((path) => existsSync(path));
  if (taken.length > 0) {
    throw new GenError(
      `Файлы уже существуют, ничего не записано (перезапись запрещена):\n` +
        taken.map((path) => `  ${path}`).join('\n'),
    );
  }

  // Правки считаем целиком до записи: сбой чтения не оставит половину результата.
  const pending = new Map<string, string>();
  const edited: string[] = [];
  const hints: HintedEdit[] = [];
  const failed = new Set<string>();
  const hint = (edit: PlannedEdit, reason: string | undefined) => {
    hints.push(reason === undefined ? edit : { ...edit, reason });
    if (edit.group !== undefined) failed.add(edit.group);
  };
  for (const edit of plan.edits) {
    if (edit.group !== undefined && failed.has(edit.group)) {
      hint(edit, `не вставлена связанная правка группы ${edit.group}`);
      continue;
    }
    const planned = files.find((f) => f.path === edit.path);
    const source =
      pending.get(edit.path) ??
      planned?.content ??
      (existsSync(edit.path) ? readFileSync(edit.path, 'utf8') : undefined);
    if (source === undefined) {
      hint(edit, undefined);
      continue;
    }
    const result = insertBeforeMarker(source, edit);
    if ('skipped' in result) continue;
    if ('hint' in result) {
      hint(edit, result.hint);
      continue;
    }
    if (planned) planned.content = result.text;
    else pending.set(edit.path, result.text);
    if (!edited.includes(edit.path) && !planned) edited.push(edit.path);
  }
  const dependencyHints: PlannedDependency[] = [];
  for (const dep of plan.dependencies ?? []) {
    const source =
      pending.get(dep.path) ??
      (existsSync(dep.path) ? readFileSync(dep.path, 'utf8') : undefined);
    if (source === undefined) {
      dependencyHints.push(dep);
      continue;
    }
    const text = PackageManifest.parse(dep.path, source).withDependency(
      dep.name,
      dep.version,
    );
    if (text === undefined) continue;
    pending.set(dep.path, text);
    if (!edited.includes(dep.path)) edited.push(dep.path);
  }

  if (options.write) {
    for (const file of files) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.content, { flag: 'wx' });
    }
    for (const [path, text] of pending) writeFileSync(path, text);
  }
  return { written: paths, edited, hints, dependencyHints, skipped };
}
