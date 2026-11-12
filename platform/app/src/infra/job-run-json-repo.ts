import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Logger } from '@u7-scl/core/shared';
import type { Timestamp } from 'dmg-core';
import type { JobRunRepo } from 'dmg-core/app';

/** Источник записей хранилища в логгере. */
const SOURCE = 'job-run-repo';

/** Формат файла истории: имя задания → ISO-дата последнего прогона. */
type JobRunFile = {
  readonly version: 1;
  readonly lastRuns: Record<string, string>;
};

/**
 * История прогонов заданий в JSON-файле (порт `JobRunRepo`): переживает
 * рестарт, поэтому упущенный запуск догоняется один раз, а не на каждом старте.
 * Файл читается лениво при первом обращении и кэшируется — один экземпляр на
 * файл в процессе; пишется синхронно после каждого прогона.
 * @see docs/guides/job.md
 */
export class JobRunJsonRepo implements JobRunRepo {
  readonly #filePath: string;
  readonly #logger: Logger;
  #cache: JobRunFile | undefined;

  constructor(filePath: string, logger: Logger) {
    this.#filePath = filePath;
    this.#logger = logger;
  }

  /** Момент последнего прогона; нечитаемая дата — `undefined` и предупреждение. */
  getLastRunAt(jobName: string): Timestamp | undefined {
    const at = this.#read().lastRuns[jobName];
    if (at === undefined) return undefined;
    const ms = Date.parse(at);
    if (Number.isNaN(ms)) {
      this.#logger.warn(
        SOURCE,
        `Дата последнего прогона задания '${jobName}' в файле ${this.#filePath} не читается, прогон считается отсутствующим`,
        { value: at },
      );
      return undefined;
    }
    return ms;
  }

  setLastRunAt(jobName: string, at: Timestamp): void {
    this.#write({
      version: 1,
      lastRuns: {
        ...this.#read().lastRuns,
        [jobName]: new Date(at).toISOString(),
      },
    });
  }

  /**
   * История с диска (лениво, один раз); нет файла или он повреждён — пустая:
   * misfire не сработает один цикл, для идемпотентных job'ов это безопаснее,
   * чем падение.
   */
  #read(): JobRunFile {
    if (this.#cache !== undefined) return this.#cache;

    if (!existsSync(this.#filePath)) {
      this.#cache = { version: 1, lastRuns: {} };
      return this.#cache;
    }

    try {
      const parsed = JSON.parse(
        readFileSync(this.#filePath, 'utf8'),
      ) as Partial<JobRunFile>;
      this.#cache = { version: 1, lastRuns: parsed.lastRuns ?? {} };
    } catch {
      this.#logger.warn(
        SOURCE,
        `Файл истории прогонов ${this.#filePath} повреждён, история начинается заново`,
      );
      this.#cache = { version: 1, lastRuns: {} };
    }
    return this.#cache;
  }

  #write(data: JobRunFile): void {
    this.#cache = data;
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(this.#filePath, `${JSON.stringify(data, null, 2)}\n`);
  }
}
