/**
 * Гейт качества после работы агента: проверяет только затронутые пакеты.
 *
 * Изменённые пути (`git status`) → пакеты workspace + транзитивно зависимые →
 * `bun run check` в каждом. Корневые конфиги и файлы вне пакетов → полный
 * `bun run check`. Только `.md` → пропуск. Красный гейт — exit 2 и хвост
 * вывода в stderr (так Claude Code возвращает ошибку субагенту). Правка
 * исходников платформы в репо `dmg-core` без `docs/` — предупреждение в stdout.
 *
 * Запуск: `bun run scripts/agent-gate.ts`.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface Workspace {
  /** Имя пакета из package.json */
  name: string;
  /** Каталог относительно корня, без завершающего `/` */
  dir: string;
  /** Имена всех зависимостей (dependencies + devDependencies) */
  deps: string[];
  /** Есть ли в пакете скрипт `check` */
  hasCheck: boolean;
}

export type GatePlan =
  | { kind: 'skip'; reason: string }
  | { kind: 'full'; reason: string }
  | { kind: 'packages'; dirs: string[] };

export interface RunOutput {
  ok: boolean;
  output: string;
}

/** Запуск `bun run check` в каталоге `cwd` относительно корня */
export type Runner = (cwd: string) => Promise<RunOutput>;

export interface GateResult {
  code: 0 | 2;
  stdout: string;
  stderr: string;
}

/** `.md` в этих каталогах — источник и копии ролей, их сверяет `agents:check` */
const AGENT_DIRS = ['.agents-core/', '.claude/agents/', '.pi/agents/'];

/** Сколько последних строк вывода упавшей проверки отдавать агенту */
export const TAIL_LINES = 60;

/** Разбор `git status --porcelain -z`: переименование даёт оба пути */
export function parseStatus(out: string): string[] {
  const tokens = out.split('\0').filter((t) => t !== '');
  const paths: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i] as string;
    const status = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (status.includes('R') || status.includes('C')) {
      const orig = tokens[++i];
      if (orig !== undefined) paths.push(orig);
    }
  }
  return paths;
}

function isAgentFile(path: string): boolean {
  return AGENT_DIRS.some((dir) => path.startsWith(dir));
}

function ownerOf(path: string, workspaces: Workspace[]): Workspace | undefined {
  return workspaces.find((w) => path.startsWith(`${w.dir}/`));
}

/** Пакеты, зависящие от исходных (включая сами исходные), по workspace-зависимостям */
function withDependents(start: Workspace[], all: Workspace[]): Workspace[] {
  const seen = new Set(start.map((w) => w.name));
  const queue = [...start];
  while (queue.length > 0) {
    const current = queue.shift() as Workspace;
    for (const w of all) {
      if (!seen.has(w.name) && w.deps.includes(current.name)) {
        seen.add(w.name);
        queue.push(w);
      }
    }
  }
  return all.filter((w) => seen.has(w.name));
}

/** Изменённые пути → что прогонять */
export function planGate(paths: string[], workspaces: Workspace[]): GatePlan {
  const relevant = paths.filter((p) => !p.endsWith('.md') || isAgentFile(p));
  if (relevant.length === 0) {
    return {
      kind: 'skip',
      reason:
        paths.length === 0 ? 'нет изменений' : 'изменены только .md-файлы',
    };
  }

  const touched = new Set<Workspace>();
  for (const path of relevant) {
    const owner = ownerOf(path, workspaces);
    if (!owner) return { kind: 'full', reason: `${path} вне пакетов` };
    if (!owner.hasCheck) {
      return { kind: 'full', reason: `в ${owner.dir} нет скрипта check` };
    }
    touched.add(owner);
  }

  const targets = withDependents([...touched], workspaces);
  const unchecked = targets.find((w) => !w.hasCheck);
  if (unchecked) {
    return { kind: 'full', reason: `в ${unchecked.dir} нет скрипта check` };
  }
  return { kind: 'packages', dirs: targets.map((w) => w.dir).sort() };
}

/** Последние `n` строк текста */
export function tail(text: string, n: number): string {
  const lines = text.trimEnd().split('\n');
  return lines.slice(-n).join('\n');
}

/** Выполнить план: все проверки параллельно, упавшие — в stderr */
export async function runGate(
  plan: GatePlan,
  run: Runner,
): Promise<GateResult> {
  if (plan.kind === 'skip') {
    return {
      code: 0,
      stdout: `agent-gate: пропуск — ${plan.reason}`,
      stderr: '',
    };
  }

  const dirs = plan.kind === 'full' ? ['.'] : plan.dirs;
  const header =
    plan.kind === 'full'
      ? `agent-gate: полный check (${plan.reason})`
      : `agent-gate: check в ${dirs.join(', ')}`;

  const results = await Promise.all(
    dirs.map(async (dir) => ({ dir, ...(await run(dir)) })),
  );
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    return { code: 0, stdout: `${header} — зелёный`, stderr: '' };
  }

  const details = failed
    .map((r) => `── ${r.dir} ──\n${tail(r.output, TAIL_LINES)}`)
    .join('\n\n');
  return {
    code: 2,
    stdout: header,
    stderr: `agent-gate: красный в ${failed.map((r) => r.dir).join(', ')}. Исправь ошибки и заверши работу снова.\n\n${details}`,
  };
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Пакеты workspace по шаблонам `workspaces` корневого package.json */
export async function loadWorkspaces(root: string): Promise<Workspace[]> {
  const rootPkg = await readJson(join(root, 'package.json'));
  const patterns = (rootPkg.workspaces ?? []) as string[];
  const list: Workspace[] = [];
  for (const pattern of patterns) {
    const glob = new Bun.Glob(`${pattern}/package.json`);
    for await (const file of glob.scan({ cwd: root })) {
      const pkg = await readJson(join(root, file));
      const deps = {
        ...(pkg.dependencies as object | undefined),
        ...(pkg.devDependencies as object | undefined),
      };
      const scripts = (pkg.scripts ?? {}) as Record<string, string>;
      list.push({
        name: pkg.name as string,
        dir: dirname(file),
        deps: Object.keys(deps).sort(),
        hasCheck: 'check' in scripts,
      });
    }
  }
  return list;
}

/** Запуск команды с CI=true; вывод — stdout и stderr вместе */
export async function exec(cmd: string[], cwd: string): Promise<RunOutput> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, CI: 'true' },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { ok: code === 0, output: `${stdout}\n${stderr}` };
}

/** Исходники платформы, правка которых обычно меняет поток или контракт (D-59 пакета) */
const PLATFORM_SRC_RE = /^src\/(?:app|kernel|domain)\/.+(?<!\.test)\.ts$/;

/**
 * Предупреждение: в репо `dmg-core` правка `src/{app,kernel,domain}` без
 * правки `docs/`. `impact` — документы по `docs:impact` пакета.
 */
export function docsWarning(
  paths: string[],
  impact: (paths: string[]) => string[],
): string | undefined {
  const sources = paths.filter((p) => PLATFORM_SRC_RE.test(p));
  if (sources.length === 0 || paths.some((p) => p.startsWith('docs/'))) {
    return undefined;
  }
  const docs = impact(sources);
  const hint =
    docs.length > 0
      ? `проверь документы: ${docs.join(', ')}`
      : 'covers не совпали — проверь concepts и decisions.md';
  return `agent-gate: предупреждение — dmg-core: правка src/{app,kernel,domain} без правки docs/; ${hint} (D-59)`;
}

/** Репо `dmg-core`, если корневой package.json подключает его как `file:` */
export async function packageRepo(root: string): Promise<string | undefined> {
  const pkg = await readJson(join(root, 'package.json'));
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  const spec = deps['dmg-core'];
  return spec?.startsWith('file:') ? join(root, spec.slice(5)) : undefined;
}

/** Изменённые пути рабочего дерева; разбирается только stdout git */
export function changedPaths(root: string): string[] {
  const proc = Bun.spawnSync(
    ['git', 'status', '--porcelain', '-z', '--untracked-files=all'],
    { cwd: root },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`git status упал: ${proc.stderr.toString()}`);
  }
  return parseStatus(proc.stdout.toString());
}

if (import.meta.main) {
  const root = process.cwd();
  const plan = planGate(changedPaths(root), await loadWorkspaces(root));
  const result = await runGate(plan, (dir) =>
    exec(['bun', 'run', 'check'], join(root, dir)),
  );
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  const repo = await packageRepo(root);
  const warning =
    repo &&
    docsWarning(changedPaths(repo), (paths) =>
      Bun.spawnSync(['bun', 'run', 'scripts/docs-impact.ts', ...paths], {
        cwd: repo,
      })
        .stdout.toString()
        .split('\n')
        .filter((line) => line !== ''),
    );
  if (warning) console.log(warning);
  process.exit(result.code);
}
