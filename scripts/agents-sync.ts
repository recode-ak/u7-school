/**
 * Генератор ролей агентов: роли пакета `dmg-core` (`packages/dmg-core/agents/roles`)
 * и проектные (`.agents-core/roles`) → копии под Claude Code и pi. Общий блок
 * копии — общий блок пакета, затем проектный.
 *
 *   bun run agents:sync   — пересобрать копии
 *   bun run agents:check  — проверить, что копии совпадают с источником
 *
 * Формат источника — `.agents-core/README.md`.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/** Среда, под которую собирается копия роли */
export type Env = 'claude' | 'pi';

const TOOLS = {
  read: { claude: 'Read', pi: 'read' },
  edit: { claude: 'Edit', pi: 'edit' },
  write: { claude: 'Write', pi: 'write' },
  bash: { claude: 'Bash', pi: 'bash' },
  grep: { claude: 'Grep', pi: 'grep' },
  find: { claude: 'Glob', pi: 'find' },
} as const satisfies Record<string, Record<Env, string>>;

/** Нейтральное имя инструмента */
export type Tool = keyof typeof TOOLS;

const ENVS: readonly Env[] = ['claude', 'pi'];
const FIELDS = ['name', 'description', 'tools', 'model'];

export const SOURCE_DIR = '.agents-core/roles';
/** Общий блок проекта, дописываемый в конец каждой роли (необязателен) */
export const COMMON_FILE = '.agents-core/common.md';
/**
 * Роли и общий блок пакета `dmg-core`. Пока нет `dmg-core init`/`sync`,
 * читаются из пакета напрямую (TR-28).
 */
export const PACKAGE_ROLES_DIR = 'packages/dmg-core/agents/roles';
export const PACKAGE_COMMON_FILE = 'packages/dmg-core/agents/common.md';
export const TARGET_DIRS: Record<Env, string> = {
  claude: '.claude/agents',
  pi: '.pi/agents',
};

/** Метка, по которой генератор узнаёт свои копии */
const GENERATED_MARK = 'командой `bun run agents:sync` — не править.';

/** Роль, разобранная из файла источника */
export interface Role {
  source: string;
  name: string;
  description: string;
  tools: Tool[];
  model: Partial<Record<Env, string>>;
  body: string;
}

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

function isTool(value: unknown): value is Tool {
  return typeof value === 'string' && value in TOOLS;
}

function isEnv(value: string): value is Env {
  return (ENVS as readonly string[]).includes(value);
}

/**
 * Разбирает файл источника роли. Бросает Error с путём файла
 * при любом нарушении формата.
 */
export function parseRole(path: string, text: string): Role {
  const fail = (message: string): never => {
    throw new Error(`${path}: ${message}`);
  };
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) return fail('нет frontmatter');
  const fm = Bun.YAML.parse(match[1] ?? '');
  if (typeof fm !== 'object' || fm === null || Array.isArray(fm)) {
    return fail('frontmatter должен быть объектом');
  }
  const data = fm as Record<string, unknown>;

  for (const key of Object.keys(data)) {
    if (!FIELDS.includes(key)) fail(`неизвестное поле «${key}»`);
  }
  const expectedName = basename(path, '.md');
  if (data.name !== expectedName) {
    fail(`name «${String(data.name)}» не совпадает с именем файла`);
  }
  if (typeof data.description !== 'string' || data.description === '') {
    fail('нужен description');
  }
  if (!Array.isArray(data.tools) || data.tools.length === 0) {
    fail('нужен непустой список tools');
  }
  const tools = (data.tools as unknown[]).map((tool) =>
    isTool(tool) ? tool : fail(`неизвестный инструмент «${String(tool)}»`),
  );

  const model: Partial<Record<Env, string>> = {};
  if (data.model !== undefined) {
    if (typeof data.model !== 'object' || data.model === null) {
      fail('model должен быть объектом { claude?, pi? }');
    }
    for (const [env, value] of Object.entries(data.model as object)) {
      if (!isEnv(env)) fail(`неизвестная среда модели «${env}»`);
      if (typeof value !== 'string') fail(`model.${env} должен быть строкой`);
      model[env as Env] = value as string;
    }
  }

  return {
    source: path,
    name: expectedName,
    description: data.description as string,
    tools,
    model,
    body: (match[2] ?? '').trim(),
  };
}

/** Собирает текст копии роли для среды; common — общий блок всех ролей */
export function renderRole(env: Env, role: Role, common = ''): string {
  const lines = [
    '---',
    `name: ${role.name}`,
    `description: ${JSON.stringify(role.description)}`,
    `tools: ${role.tools.map((tool) => TOOLS[tool][env]).join(', ')}`,
  ];
  const model = role.model[env];
  if (model) lines.push(`model: ${model}`);
  lines.push(
    '---',
    '',
    `<!-- Сгенерировано из ${role.source} ${GENERATED_MARK} -->`,
    '',
    role.body,
    '',
  );
  if (common.trim()) lines.push(common.trim(), '');
  return lines.join('\n');
}

/** Ожидаемые копии всех ролей: путь от корня → содержимое */
export function buildCopies(
  sources: SourceFile[],
  common = '',
): Map<string, string> {
  const copies = new Map<string, string>();
  const seen = new Map<string, string>();
  for (const { path, text } of sources) {
    const role = parseRole(path, text);
    const first = seen.get(role.name);
    if (first !== undefined) {
      throw new Error(`${path}: роль ${role.name} уже задана в ${first}`);
    }
    seen.set(role.name, path);
    for (const env of ENVS) {
      copies.set(
        `${TARGET_DIRS[env]}/${role.name}.md`,
        renderRole(env, role, common),
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
  for (const dir of [PACKAGE_ROLES_DIR, SOURCE_DIR]) {
    for (const [path, text] of await readMarkdown(root, dir)) {
      sources.push({ path, text });
    }
  }
  const commons = await Promise.all(
    [PACKAGE_COMMON_FILE, COMMON_FILE].map((file) =>
      readFile(join(root, file), 'utf8').catch(() => ''),
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
