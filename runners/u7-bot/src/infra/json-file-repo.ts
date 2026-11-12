import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getGlobalLogger, now } from '@u7-scl/core/shared';
import type { GenericSchema } from 'valibot';
import * as v from 'valibot';

/**
 * Ошибка, возникающая при повреждении структуры JSON-файла.
 * Выбрасывается, чтобы предотвратить потерю данных (например,
 * когда битый файл мог бы быть перезаписан seed-данными).
 */
export class JsonFileRepoError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
  ) {
    super(`[JsonFileRepo] ${filePath}: ${message}`);
    this.name = 'JsonFileRepoError';
  }
}

/**
 * Универсальный JSON-файловый репозиторий.
 * Хранит массив объектов в JSON-файле с валидацией через Valibot-схему.
 *
 * @typeParam T — DTO-тип хранимых объектов
 */
export class JsonFileRepo<T> {
  readonly #schema: GenericSchema<T>;
  readonly #filePath: string;
  /** Уже создан бэкап текущих невалидных данных (защита от дублей) */
  #invalidBackedUp = false;

  /** Путь к JSON-файлу */
  get filePath(): string {
    return this.#filePath;
  }

  /**
   * @param schema — Valibot-схема для валидации каждого объекта
   * @param filePath — путь к JSON-файлу
   */
  constructor(schema: GenericSchema<T>, filePath: string) {
    this.#schema = schema;
    this.#filePath = filePath;
  }

  /**
   * Читает все объекты из файла.
   * - Отсутствующий файл → пустой массив
   * - Невалидный JSON или не-массив → выбрасывает JsonFileRepoError
   * - Отдельные невалидные объекты пропускаются с console.warn; при первом
   *   обнаружении невалидных записей создаётся бэкап файла (см. #backupInvalid)
   */
  async readAll(): Promise<T[]> {
    let raw: unknown[];

    const file = Bun.file(this.#filePath);

    if (!(await file.exists())) {
      return [];
    }

    try {
      raw = await file.json();
    } catch (cause) {
      throw new JsonFileRepoError(
        `Не удалось распарсить JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        this.#filePath,
      );
    }

    if (!Array.isArray(raw)) {
      throw new JsonFileRepoError(
        `Ожидался JSON-массив, получен ${typeof raw}`,
        this.#filePath,
      );
    }

    const result: T[] = [];
    let invalidCount = 0;

    for (const item of raw) {
      const parsed = v.safeParse(this.#schema, item);
      if (parsed.success) {
        result.push(parsed.output);
      } else {
        invalidCount++;
        getGlobalLogger()?.warn(
          'json-repo',
          `Пропущена невалидная запись в файле ${this.#filePath}`,
          { issues: v.flatten(parsed.issues) },
        );
      }
    }

    if (invalidCount > 0) {
      await this.#backupInvalid(invalidCount);
    }

    return result;
  }

  /**
   * Записывает массив объектов в файл (полная перезапись).
   * Перед записью проверок нет: бэкап при ошибках валидации делается
   * при чтении (см. #backupInvalid), а перезапись сбрасывает его флаг —
   * следующая порция невалидных данных получит новый бэкап.
   */
  async writeAll(items: T[]): Promise<void> {
    this.#invalidBackedUp = false;

    await Bun.write(this.#filePath, JSON.stringify(items, null, 2));
  }

  /**
   * Бэкап файла при обнаружении невалидных записей: при полной перезаписи
   * (writeAll) они были бы потеряны, поэтому копия делается в момент чтения —
   * в <каталог файла>/backups/<имя>.invalid.<таймштамп>.json.
   * Флаг #invalidBackedUp защищает от дублей при повторных чтениях;
   * сбрасывается при записи.
   */
  async #backupInvalid(invalidCount: number): Promise<void> {
    if (this.#invalidBackedUp) return;
    this.#invalidBackedUp = true;

    const dir = path.dirname(this.#filePath);
    const ext = path.extname(this.#filePath);
    const base = path.basename(this.#filePath, ext);
    const stamp = now().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const backupPath = path.join(
      dir,
      'backups',
      `${base}.invalid.${stamp}${ext}`,
    );

    await mkdir(path.dirname(backupPath), { recursive: true });
    await Bun.write(backupPath, Bun.file(this.#filePath));

    getGlobalLogger()?.info(
      'json-repo',
      `В файле ${this.#filePath} обнаружены невалидные записи (${invalidCount}) — создан бэкап: ${backupPath}`,
    );
  }
}
