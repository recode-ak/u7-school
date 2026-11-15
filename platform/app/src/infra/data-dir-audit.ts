import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as v from 'valibot';
import { DATA_FILES, DATA_MODULES } from '../data-layout';

/** Что аудиту нужно от `*ModuleDef`: имя и схема `state` каждого агрегата. */
type AuditedModule = {
  readonly aggregates: readonly {
    readonly name: string;
    readonly state: v.GenericSchema;
  }[];
};

const MODULES: readonly AuditedModule[] = DATA_MODULES;

const FILES: Readonly<Record<string, string>> = DATA_FILES;

/** Ошибка чтения: без `index` — файл целиком (не JSON, не массив). */
export type AuditIssue = {
  readonly file: string;
  readonly index?: number;
  readonly uuid?: string;
  readonly message: string;
};

export type AuditFile = {
  readonly file: string;
  readonly missing: boolean;
  readonly records: number;
};

export type AuditReport = {
  readonly ok: boolean;
  readonly files: readonly AuditFile[];
  readonly issues: readonly AuditIssue[];
};

/**
 * Контрольное чтение каталога данных: каждая запись каждого файла из
 * `DATA_FILES` — по схеме `state` своего агрегата, как читает repo. Не пишет и
 * не бросает. Инварианты уровня repo (`CourseProgramInvariant`) не проверяются.
 */
export class DataDirAudit {
  readonly #dbDir: string;

  constructor(dbDir: string) {
    this.#dbDir = dbDir;
  }

  async run(): Promise<AuditReport> {
    const files: AuditFile[] = [];
    const issues: AuditIssue[] = [];
    for (const aggregate of MODULES.flatMap((m) => m.aggregates)) {
      const file = FILES[aggregate.name];
      if (file === undefined) {
        issues.push({ file: aggregate.name, message: 'нет пути в DATA_FILES' });
        continue;
      }
      files.push(this.#audit(file, aggregate.state, issues));
    }
    return { ok: issues.length === 0, files, issues };
  }

  #audit(
    file: string,
    schema: v.GenericSchema,
    issues: AuditIssue[],
  ): AuditFile {
    const path = join(this.#dbDir, file);
    if (!existsSync(path)) return { file, missing: true, records: 0 };
    let rows: unknown;
    try {
      rows = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      issues.push({ file, message: `не JSON: ${(e as Error).message}` });
      return { file, missing: false, records: 0 };
    }
    if (!Array.isArray(rows)) {
      issues.push({ file, message: 'ожидается массив записей' });
      return { file, missing: false, records: 0 };
    }
    rows.forEach((row: unknown, index) => {
      const result = v.safeParse(schema, row);
      if (result.success) return;
      const uuid = DataDirAudit.#uuidOf(row);
      issues.push({
        file,
        index,
        ...(uuid === undefined ? {} : { uuid }),
        message: result.issues
          .map((i) => `${v.getDotPath(i) ?? '(запись)'}: ${i.message}`)
          .join('; '),
      });
    });
    return { file, missing: false, records: rows.length };
  }

  static #uuidOf(row: unknown): string | undefined {
    if (typeof row !== 'object' || row === null || !('uuid' in row)) {
      return undefined;
    }
    return typeof row.uuid === 'string' ? row.uuid : undefined;
  }
}
