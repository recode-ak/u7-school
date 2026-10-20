/** Применение плана: сначала всё проверяем, затем пишем; перезаписей нет. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { GenError } from './cli.ts';
import type { ApplyResult, GenPlan, PlannedEdit, PlannedFile } from './plan.ts';

/** Точка входа legacy-модуля: в режиме adopt не перезаписывается. */
const ENTRY_FILE = 'index.ts';

const SOURCE_LINE = /^(?:import|export)\b.*\bfrom '([^']+)';$/;

/** Порядок biome: пакеты раньше относительных путей, дальше по строке пути. */
function sourceOrder(line: string): [number, string] | undefined {
  const source = SOURCE_LINE.exec(line.trim())?.[1];
  return source === undefined
    ? undefined
    : [source.startsWith('.') ? 1 : 0, source];
}

/** Биом ставит `.` раньше `-` в путях (`./a.facade` < `./a-b.dcs`). */
const pathKey = (path: string) =>
  path.replaceAll('.', '\u0001').replaceAll('-', '\u0002');

function isBefore(a: [number, string], b: [number, string]): boolean {
  if (a[0] !== b[0]) return a[0] < b[0];
  return pathKey(a[1]) < pathKey(b[1]);
}

/** Куда вставить `line`: в отсортированный блок import/export над маркером. */
function insertionIndex(lines: string[], marker: number, line: string): number {
  const order = sourceOrder(line);
  if (order === undefined) return marker;
  let start = marker;
  while (start > 0 && sourceOrder(lines[start - 1] ?? '') !== undefined)
    start--;
  for (let i = start; i < marker; i++) {
    const other = sourceOrder(lines[i] ?? '');
    if (other && isBefore(order, other)) return i;
  }
  return marker;
}

/** Результат правки одного маркера: новый текст или причина отказа. */
function insertBeforeMarker(
  text: string,
  edit: PlannedEdit,
): { text: string } | { skipped: 'present' | 'no-marker' } {
  const lines = text.split('\n');
  if (lines.some((l) => l.trim() === edit.line.trim())) {
    return { skipped: 'present' };
  }
  const at = lines.findIndex((l) => l.trim() === edit.marker);
  if (at === -1) return { skipped: 'no-marker' };
  lines.splice(insertionIndex(lines, at, edit.line), 0, edit.line);
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
        (f) => basename(f.path) === ENTRY_FILE && existsSync(f.path),
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
  const hints: PlannedEdit[] = [];
  for (const edit of plan.edits) {
    const planned = files.find((f) => f.path === edit.path);
    const source =
      pending.get(edit.path) ??
      planned?.content ??
      (existsSync(edit.path) ? readFileSync(edit.path, 'utf8') : undefined);
    if (source === undefined) {
      hints.push(edit);
      continue;
    }
    const result = insertBeforeMarker(source, edit);
    if ('skipped' in result) {
      if (result.skipped === 'no-marker') hints.push(edit);
      continue;
    }
    if (planned) planned.content = result.text;
    else pending.set(edit.path, result.text);
    if (!edited.includes(edit.path) && !planned) edited.push(edit.path);
  }

  if (options.write) {
    for (const file of files) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.content, { flag: 'wx' });
    }
    for (const [path, text] of pending) writeFileSync(path, text);
  }
  return { written: paths, edited, hints, skipped };
}
