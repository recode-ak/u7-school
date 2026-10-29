/**
 * Генератор ролей агентов: роли из `.agents-core/roles` (проектные и роли
 * пакета `dmg-core`, доставленные `bun run dmg:sync`) → копии под Claude Code
 * и pi. Общий блок копии — общий блок пакета, затем проектный.
 *
 *   bun run agents:sync   — пересобрать копии
 *   bun run agents:check  — проверить, что копии совпадают с источником
 *
 * Формат источника — `.agents-core/README.md`; разбор и отрисовка — `Role`
 * пакета (`dmg-core/cli`), метка копии — своя.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type AgentEnv, Marker, Role } from 'dmg-core/cli';

const ENVS: readonly AgentEnv[] = ['claude', 'pi'];

export const SOURCE_DIR = '.agents-core/roles';
/** Общий блок проекта, дописываемый в конец каждой роли (необязателен) */
export const COMMON_FILE = '.agents-core/common.md';
/** Общий блок пакета `dmg-core` — кладёт `dmg-core sync` (`dmg-core.json`) */
export const DMG_COMMON_FILE = '.agents-core/dmg-core-common.md';
export const TARGET_DIRS: Record<AgentEnv, string> = {
  claude: '.claude/agents',
  pi: '.pi/agents',
};

/** Метка, по которой генератор узнаёт свои копии */
const GENERATED_MARK = 'командой `bun run agents:sync` — не править.';

/** Файл источника: путь от корня репозитория и содержимое */
export interface SourceFile {
  path: string;
  text: string;
}

/** Расхождение копий с источником (пути от корня репозитория) */
export interface Drift {
  changed: string[];
  missing: string[];
  extra: string[];
}

/** Итог запуска: ok — копии совпадают с источником */
export interface SyncResult {
  ok: boolean;
  messages: string[];
}

/** Метка копии проекта: источник роли и команда сборки */
function commentOf(source: string): string {
  return `<!-- Сгенерировано из ${source} ${GENERATED_MARK} -->`;
}

/** Ожидаемые копии всех ролей: путь от корня → содержимое */
export function buildCopies(
  sources: SourceFile[],
  common = '',
): Map<string, string> {
  const copies = new Map<string, string>();
  const seen = new Map<string, string>();
  for (const { path, text } of sources) {
    const role = Role.parse(path, text);
    const first = seen.get(role.name);
    if (first !== undefined) {
      throw new Error(`${path}: роль ${role.name} уже задана в ${first}`);
    }
    seen.set(role.name, path);
    for (const env of ENVS) {
      copies.set(
        `${TARGET_DIRS[env]}/${role.name}.md`,
        role.renderEnv(env, commentOf(path), common),
      );
    }
  }
  return copies;
}

/** Сравнивает ожидаемые копии с фактическими файлами */
export function compareCopies(
  expected: Map<string, string>,
  actual: Map<string, string>,
): Drift {
  const drift: Drift = { changed: [], missing: [], extra: [] };
  for (const [path, text] of expected) {
    const current = actual.get(path);
    if (current === undefined) drift.missing.push(path);
    else if (current !== text) drift.changed.push(path);
  }
  for (const path of actual.keys()) {
    if (!expected.has(path)) drift.extra.push(path);
  }
  return drift;
}

async function readMarkdown(
  root: string,
  dir: string,
): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const names = await readdir(join(root, dir)).catch(() => []);
  for (const name of names.filter((n) => n.endsWith('.md')).sort()) {
    files.set(`${dir}/${name}`, await readFile(join(root, dir, name), 'utf8'));
  }
  return files;
}

function manualMessage(path: string): string {
  return `лишний файл (не сгенерирован, удали или перенеси в ${SOURCE_DIR}): ${path}`;
}

/**
 * Сверяет (mode = 'check') или пересобирает (mode = 'sync') копии ролей
 * в репозитории `root`. Sync удаляет только сгенерированные копии без источника.
 */
export async function runSync(
  root: string,
  mode: 'sync' | 'check',
): Promise<SyncResult> {
  const sources: SourceFile[] = [];
  for (const [path, text] of await readMarkdown(root, SOURCE_DIR)) {
    sources.push({ path, text: Marker.strip(text) });
  }
  const commons = await Promise.all(
    [DMG_COMMON_FILE, COMMON_FILE].map(async (file) =>
      Marker.strip(await readFile(join(root, file), 'utf8').catch(() => '')),
    ),
  );
  const common = commons
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .join('\n\n');
  let expected: Map<string, string>;
  try {
    expected = buildCopies(sources, common);
  } catch (error) {
    return { ok: false, messages: [(error as Error).message] };
  }
  const actual = new Map<string, string>();
  for (const dir of Object.values(TARGET_DIRS)) {
    for (const [path, text] of await readMarkdown(root, dir)) {
      actual.set(path, text);
    }
  }
  const drift = compareCopies(expected, actual);
  const generated = (path: string) =>
    actual.get(path)?.includes(GENERATED_MARK) ?? false;

  if (mode === 'check') {
    const messages = [
      ...drift.changed.map((p) => `расходится с источником: ${p}`),
      ...drift.missing.map((p) => `нет копии: ${p}`),
      ...drift.extra.map((p) =>
        generated(p) ? `копия без источника: ${p}` : manualMessage(p),
      ),
    ];
    return { ok: messages.length === 0, messages };
  }

  for (const path of [...drift.changed, ...drift.missing]) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), expected.get(path) ?? '');
  }
  const manual: string[] = [];
  for (const path of drift.extra) {
    if (generated(path)) await rm(join(root, path));
    else manual.push(path);
  }
  return { ok: manual.length === 0, messages: manual.map(manualMessage) };
}

if (import.meta.main) {
  const mode = process.argv.includes('--check') ? 'check' : 'sync';
  const result = await runSync(process.cwd(), mode);
  for (const message of result.messages) console.error(message);
  if (!result.ok) {
    if (mode === 'check') {
      console.error('Пересобери копии: bun run agents:sync');
    }
    process.exit(1);
  }
}
