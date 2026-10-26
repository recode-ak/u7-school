import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { OperationLog, OperationRecord } from './operation-record';

/** Порог размера `input`/`output` записи по умолчанию — ≈8 КБ. */
export const DEFAULT_OPLOG_MAX_BYTES = 8 * 1024;

/** Обрезанное значение: размер исходного JSON и его начало. */
export type TruncatedValue = {
  readonly truncated: true;
  readonly bytes: number;
  readonly head: string;
};

/**
 * Порог размера значения в записи: JSON длиннее `maxBytes` (UTF-8)
 * заменяется пометкой с размером и началом строки, не длиннее порога.
 */
class SizeLimit {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  constructor(private readonly maxBytes: number) {}

  apply(value: unknown): unknown {
    if (value === undefined) return value;
    const json = JSON.stringify(value);
    const bytes = this.encoder.encode(json);
    if (bytes.length <= this.maxBytes) return value;
    // Срез по байтам может разрезать символ — неполный хвост отбрасывается.
    const head = this.decoder
      .decode(bytes.subarray(0, this.maxBytes))
      .replace(/�+$/, '');
    const truncated: TruncatedValue = {
      truncated: true,
      bytes: bytes.length,
      head,
    };
    return truncated;
  }
}

/**
 * Лог операций в JSONL: файл на день (`YYYY-MM-DD.jsonl`, UTC по `at`),
 * строка на запись. Каталог создаётся при первой записи; записи идут
 * по очереди — строки параллельных операций не перемешиваются.
 * `input` и `output` больше порога обрезаются с пометкой (`TruncatedValue`).
 */
export class JsonlOperationLog implements OperationLog {
  private readonly limit: SizeLimit;
  private queue: Promise<void> = Promise.resolve();
  private ready: Promise<unknown> | undefined;

  constructor(
    private readonly dir: string,
    options: { readonly maxBytes?: number } = {},
  ) {
    this.limit = new SizeLimit(options.maxBytes ?? DEFAULT_OPLOG_MAX_BYTES);
  }

  append(record: OperationRecord): Promise<void> {
    const line = `${JSON.stringify(this.limited(record))}\n`;
    const file = join(this.dir, `${this.day(record)}.jsonl`);
    const next = this.queue.then(async () => {
      this.ready ??= mkdir(this.dir, { recursive: true }).catch((error) => {
        this.ready = undefined;
        throw error;
      });
      await this.ready;
      await appendFile(file, line, 'utf8');
    });
    // Сбой одной записи не должен блокировать следующие.
    this.queue = next.catch(() => {});
    return next;
  }

  private limited(record: OperationRecord): OperationRecord {
    const { result } = record;
    return {
      ...record,
      input: this.limit.apply(record.input),
      result: result.ok
        ? { ok: true, output: this.limit.apply(result.output) }
        : result,
    };
  }

  private day(record: OperationRecord): string {
    return new Date(record.at).toISOString().slice(0, 10);
  }
}
