import { GenError } from '../../gen/cli';

/** Объект JSON. */
type JsonObject = Record<string, unknown>;

/** Секции зависимостей: зависимость ищется во всех, не дублируется. */
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Существующий `package.json` проекта (поток `bun add dmg-core && bunx
 * dmg-core init --profile …`): его имя и слияние с `package.json` каркаса.
 * Поля проекта сохраняются, отсутствующие добавляются из каркаса;
 * тот же ключ с другим значением — конфликт (`GenError`, все ключи сразу).
 * Зависимость: версия проекта выигрывает, зависимость в другой секции
 * остаётся на месте, пустая секция не добавляется. Добавлять нечего
 * (по содержимому) — `merge` возвращает undefined: файл не переписывается.
 * Чистый: файлы читает и пишет `ProjectInit`.
 */
export class ProjectManifest {
  static parse(text: string): ProjectManifest {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new GenError('package.json проекта — не JSON');
    }
    if (!isObject(data)) {
      throw new GenError('package.json проекта — не объект JSON');
    }
    return new ProjectManifest(data);
  }

  private constructor(private readonly data: JsonObject) {}

  /** Поле `name`; нет или не строка — undefined. */
  name(): string | undefined {
    const name = this.data.name;
    return typeof name === 'string' ? name : undefined;
  }

  /**
   * Слитый текст в форме biome (как `package.json` каркаса); undefined —
   * из каркаса добавлять нечего.
   */
  merge(scaffold: string): string | undefined {
    const result: JsonObject = structuredClone(this.data);
    const conflicts: string[] = [];
    for (const [key, value] of Object.entries(JSON.parse(scaffold))) {
      if (DEPENDENCY_SECTIONS.includes(key) && isObject(value)) {
        this.addDependencies(result, key, value, conflicts);
      } else {
        this.addValue(result, key, value, key, conflicts);
      }
    }
    if (conflicts.length > 0) {
      throw new GenError(
        'package.json проекта расходится с каркасом, ничего не записано:\n' +
          conflicts.map((line) => `  ${line}`).join('\n'),
      );
    }
    // Слияние только добавляет ключи (порядок прежних сохранён), поэтому
    // равенство сериализаций — равенство содержимого.
    if (JSON.stringify(result) === JSON.stringify(this.data)) return undefined;
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  private addValue(
    target: JsonObject,
    key: string,
    value: unknown,
    path: string,
    conflicts: string[],
  ): void {
    if (!(key in target)) {
      target[key] = value;
      return;
    }
    const current = target[key];
    if (isObject(current) && isObject(value)) {
      for (const [k, v] of Object.entries(value))
        this.addValue(current, k, v, `${path}.${k}`, conflicts);
    } else if (JSON.stringify(current) !== JSON.stringify(value)) {
      conflicts.push(this.conflict(path, current, value));
    }
  }

  private addDependencies(
    target: JsonObject,
    section: string,
    dependencies: JsonObject,
    conflicts: string[],
  ): void {
    const current = target[section] ?? {};
    if (!isObject(current)) {
      conflicts.push(this.conflict(section, current, dependencies));
      return;
    }
    for (const [name, version] of Object.entries(dependencies)) {
      const present = DEPENDENCY_SECTIONS.some((s) => {
        const deps = target[s];
        return isObject(deps) && name in deps;
      });
      if (!present) current[name] = version;
    }
    if (Object.keys(current).length > 0) target[section] = current;
  }

  private conflict(path: string, current: unknown, value: unknown): string {
    return `«${path}»: в проекте ${JSON.stringify(current)}, каркас ждёт ${JSON.stringify(value)}`;
  }
}
