import { createHash } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import type { Clock, ReplayClaim, ReplayStore } from 'dmg-core/app';
import * as v from 'valibot';

/** Сколько живёт запись отсева по умолчанию: 24 ч (D-56 пакета). */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Запись в файле: ключ, владелец, вход, ответ (нет — «в работе»), срок. */
const ReplayEntrySchema = v.object({
  key: v.string(),
  token: v.string(),
  input: v.string(),
  answered: v.boolean(),
  answer: v.unknown(),
  expiresAt: v.number(),
});

type ReplayEntry = v.InferOutput<typeof ReplayEntrySchema>;

/**
 * Файловый `ReplayStore` (D-56 пакета `dmg-core`): записи отсева повторов
 * команд переживают рестарт — основной случай повторной доставки апдейта
 * Telegram. Запись — файл `<dir>/<sha256(key)>.json`, пишется атомарно
 * (временный файл + rename). Каталог не защищён git и в бэкап не входит
 * (как `oplog`): потеря записей лишь отключает отсев на срок жизни.
 *
 * Записи держатся и в памяти; файлы — их копия на случай рестарта. При
 * открытии снимаются просроченные записи и записи «в работе»: владелец —
 * прежний процесс — не завершит их, а повтор иначе получал бы конфликт
 * до конца срока. Битые файлы пропускаются (не удаляются). Операции идут
 * по одной (очередь): проверка и занятие ключа атомарны, файл ключа не
 * пишут и не удаляют одновременно. Хранилище — для одного процесса.
 */
export class FileReplayStore implements ReplayStore {
  /** Порядок вставки — порядок последней записи, значит и истечения срока. */
  readonly #entries = new Map<string, ReplayEntry>();
  /** Хвост очереди операций. */
  #tail: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly dir: string,
    private readonly clock: Clock,
    private readonly ttlMs: number,
  ) {}

  /** Открывает хранилище над каталогом (создаёт его) и читает записи. */
  static async open(options: {
    readonly dir: string;
    readonly clock: Clock;
    readonly ttlMs?: number;
  }): Promise<FileReplayStore> {
    const store = new FileReplayStore(
      options.dir,
      options.clock,
      options.ttlMs ?? DEFAULT_TTL_MS,
    );
    await mkdir(options.dir, { recursive: true });
    await store.#load();
    return store;
  }

  claim(key: string, input: string): Promise<ReplayClaim> {
    return this.#serial(async () => {
      await this.#forgetExpired();
      const entry = this.#entries.get(key);
      if (entry === undefined) {
        const token = crypto.randomUUID();
        await this.#put({ key, token, input, answered: false, answer: null });
        return { kind: 'claimed', token };
      }
      if (entry.input !== input) return { kind: 'conflict', reason: 'input' };
      if (!entry.answered) return { kind: 'conflict', reason: 'in_progress' };
      return { kind: 'answered', answer: structuredClone(entry.answer) };
    });
  }

  complete(key: string, token: string, answer: unknown): Promise<void> {
    return this.#serial(async () => {
      await this.#forgetExpired();
      const entry = this.#entries.get(key);
      if (entry?.token !== token) return;
      await this.#put({
        ...entry,
        answered: true,
        answer: structuredClone(answer),
      });
    });
  }

  release(key: string, token: string): Promise<void> {
    return this.#serial(async () => {
      if (this.#entries.get(key)?.token !== token) return;
      await this.#forget(key);
    });
  }

  /** Ставит операцию в очередь: следующая начнётся после её завершения. */
  #serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(fn, fn);
    this.#tail = next.catch(() => undefined);
    return next;
  }

  /** Читает записи каталога; просроченные и «в работе» снимает с файлом. */
  async #load(): Promise<void> {
    const now = this.clock();
    const loaded: ReplayEntry[] = [];
    for (const name of await readdir(this.dir)) {
      if (!name.endsWith('.json')) continue;
      const entry = await this.#read(name);
      if (entry === undefined) continue;
      if (!entry.answered || entry.expiresAt <= now) {
        await rm(this.#file(entry.key), { force: true });
        continue;
      }
      loaded.push(entry);
    }
    loaded.sort((a, b) => a.expiresAt - b.expiresAt);
    for (const entry of loaded) this.#entries.set(entry.key, entry);
  }

  /** Запись файла; битый или чужой формат — `undefined`. */
  async #read(name: string): Promise<ReplayEntry | undefined> {
    try {
      const raw: unknown = JSON.parse(
        await readFile(path.join(this.dir, name), 'utf8'),
      );
      const parsed = v.safeParse(ReplayEntrySchema, raw);
      return parsed.success ? parsed.output : undefined;
    } catch {
      return undefined;
    }
  }

  /** Записывает в конец порядка со свежим сроком: память и файл. */
  async #put(entry: Omit<ReplayEntry, 'expiresAt'>): Promise<void> {
    const stored = { ...entry, expiresAt: this.clock() + this.ttlMs };
    this.#entries.delete(entry.key);
    this.#entries.set(entry.key, stored);
    const file = this.#file(entry.key);
    await writeFile(`${file}.tmp`, JSON.stringify(stored));
    await rename(`${file}.tmp`, file);
  }

  /** Снимает запись: память и файл. */
  async #forget(key: string): Promise<void> {
    this.#entries.delete(key);
    await rm(this.#file(key), { force: true });
  }

  /** Снимает истёкшие записи с начала порядка — они там самые старые. */
  async #forgetExpired(): Promise<void> {
    const now = this.clock();
    for (const [key, entry] of this.#entries) {
      if (entry.expiresAt > now) break;
      await this.#forget(key);
    }
  }

  /** Файл записи: ключ содержит `/`, `:`, `#` — имя из хеша ключа. */
  #file(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex');
    return path.join(this.dir, `${hash}.json`);
  }
}
