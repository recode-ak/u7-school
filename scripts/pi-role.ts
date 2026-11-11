/**
 * Запуск роли агента через pi на DeepSeek с учётом расхода.
 *
 * Роль — `.pi/agents/<role>.md` (дописывается к системному промпту), задание —
 * файл промпта. Расширения pi включены (`pi-dcp` после обновления не ломает
 * префиксный кэш); `--no-ext` отключает их — для сравнения hitRate.
 * Повторный запуск с тем же `--label` продолжает сессию (доработка
 * по гейту). Вывод pi — `.cache/pi-runs/<label>.<n>.jsonl`, строка расхода —
 * `.cache/pi-runs/usage.jsonl`. Гейт после запуска гоняет orchestrator.
 *
 * Правила постановки задач: `conductor/architecture/deepseek.md`.
 *
 * Запуск: `bun run scripts/pi-role.ts <role> <prompt-file> [--model flash|pro] [--label <имя>] [--cwd <каталог>] [--no-ext]`.
 */

import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const MODELS: Record<string, string> = {
  flash: 'deepseek/deepseek-flash',
  pro: 'deepseek/deepseek-v4-pro',
};

/** Расход одного запуска pi по событиям `message_end` ассистента. */
export class PiUsage {
  turns = 0;
  input = 0;
  cacheRead = 0;
  output = 0;
  cost = 0;
  /** Ходы (кроме первого) с попаданием в кэш < 50% — след обрезки контекста */
  misses = 0;
  /** Последний непустой текст ассистента — отчёт роли */
  answer = '';
  /** Ошибка провайдера в последнем ходе (баланс, сеть) */
  error: string | undefined;

  static fromJsonl(text: string): PiUsage {
    const u = new PiUsage();
    for (const line of text.split('\n')) {
      const event = PiUsage.#parse(line);
      const m = event?.type === 'message_end' ? event.message : undefined;
      if (m?.role !== 'assistant') continue;
      u.turns++;
      const input = m.usage?.input ?? 0;
      const cacheRead = m.usage?.cacheRead ?? 0;
      if (u.turns > 1 && cacheRead < input) u.misses++;
      u.input += input;
      u.cacheRead += cacheRead;
      u.output += m.usage?.output ?? 0;
      u.cost += m.usage?.cost?.total ?? 0;
      u.error = m.stopReason === 'error' ? m.errorMessage : undefined;
      const answer = (m.content ?? [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('\n');
      if (answer.trim()) u.answer = answer;
    }
    return u;
  }

  /** Доля входа из кэша, % */
  get hitRate(): number {
    const all = this.input + this.cacheRead;
    return all ? Math.round((100 * this.cacheRead) / all) : 0;
  }

  static #parse(line: string): PiEvent | undefined {
    if (!line.trim()) return undefined;
    try {
      return JSON.parse(line) as PiEvent;
    } catch {
      return undefined;
    }
  }
}

interface PiEvent {
  type?: string;
  message?: {
    role?: string;
    stopReason?: string;
    errorMessage?: string;
    usage?: {
      input?: number;
      cacheRead?: number;
      output?: number;
      cost?: { total?: number };
    };
    content?: { type: string; text?: string }[];
  };
}

/** Один запуск роли: собирает команду pi, пишет вывод и строку расхода. */
class PiRoleRun {
  readonly #root = resolve(import.meta.dir, '..');
  readonly #runs = join(this.#root, '.cache/pi-runs');

  constructor(
    private readonly role: string,
    private readonly promptFile: string,
    private readonly model: string,
    private readonly label: string,
    private readonly cwd: string,
    private readonly extensions: boolean,
  ) {}

  async run(): Promise<PiUsage> {
    await mkdir(join(this.#runs, 'sessions'), { recursive: true });
    const out = join(
      this.#runs,
      `${this.label}.${await this.#nextIndex()}.jsonl`,
    );
    const started = Date.now();
    const proc = Bun.spawn(
      [
        'pi',
        '-p',
        '--mode',
        'json',
        '--model',
        this.model,
        '--thinking',
        'high',
        ...(this.extensions ? [] : ['--no-extensions']),
        '--session-dir',
        join(this.#runs, 'sessions'),
        '--session-id',
        this.label,
        '--append-system-prompt',
        join(this.cwd, '.pi/agents', `${this.role}.md`),
        await readFile(this.promptFile, 'utf8'),
      ],
      { cwd: this.cwd, stdout: Bun.file(out), stderr: 'pipe' },
    );
    const code = await proc.exited;
    const usage = PiUsage.fromJsonl(await readFile(out, 'utf8'));
    const row = {
      at: new Date().toISOString(),
      label: this.label,
      role: this.role,
      model: this.model,
      ext: this.extensions,
      secs: Math.round((Date.now() - started) / 1000),
      code,
      turns: usage.turns,
      input: usage.input,
      cacheRead: usage.cacheRead,
      output: usage.output,
      hitRate: usage.hitRate,
      misses: usage.misses,
      cost: Number(usage.cost.toFixed(4)),
      error: usage.error,
    };
    await appendFile(
      join(this.#runs, 'usage.jsonl'),
      `${JSON.stringify(row)}\n`,
    );
    console.log(JSON.stringify(row));
    return usage;
  }

  async #nextIndex(): Promise<number> {
    const files = await readdir(this.#runs);
    return files.filter(
      (f) => f.startsWith(`${this.label}.`) && f.endsWith('.jsonl'),
    ).length;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const model = MODELS[opt('model') ?? 'flash'];
  const label = opt('label');
  const cwd = resolve(opt('cwd') ?? '.');
  const noExt = args.indexOf('--no-ext');
  if (noExt >= 0) args.splice(noExt, 1);
  const [role, promptFile] = args;
  if (!role || !promptFile || !model) {
    console.error(
      'Использование: bun run scripts/pi-role.ts <role> <prompt-file> [--model flash|pro] [--label <имя>] [--cwd <каталог>] [--no-ext]',
    );
    process.exit(1);
  }
  const usage = await new PiRoleRun(
    role,
    resolve(promptFile),
    model,
    label ?? `${role}-${Date.now()}`,
    cwd,
    noExt < 0,
  ).run();
  if (usage.error) console.error(`Ошибка провайдера: ${usage.error}`);
  console.log('--- отчёт роли ---');
  console.log(usage.answer);
  process.exit(usage.error ? 2 : 0);
}
