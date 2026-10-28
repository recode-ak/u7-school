import path from 'node:path';
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

/**
 * Спецификатор не из реестра: протокол (`file:`, `link:`, `github:`,
 * `https:` …), путь или `<user>/<repo>` (есть `/`), архив (`.tgz`,
 * `.tar.gz`). Диапазоны и теги реестра (`^0.1.0`, `>=0.1 <1`, `latest`)
 * не содержат ни `:`, ни `/`. `Bun.semver` не годится: тег — не диапазон,
 * но из реестра.
 */
const LOCAL_SPEC = /[:/]|\.(tgz|tar\.gz)$/;

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
   * Спецификатор зависимости `name` (любая секция), если он не из реестра
   * (tarball, `file:`, `link:`, путь, git); иначе или нет зависимости —
   * undefined.
   */
  localSpec(name: string): string | undefined {
    for (const section of DEPENDENCY_SECTIONS) {
      const deps = this.data[section];
      const spec = isObject(deps) ? deps[name] : undefined;
      if (typeof spec === 'string') {
        return LOCAL_SPEC.test(spec) ? spec : undefined;
      }
    }
    return undefined;
  }

  /**
   * Спецификатор локального пакета относительно корня проекта `root`:
   * абсолютный путь (так пишет `bun add <tarball>`) и `file:<абсолютный>` —
   * в `./…` или `../…` (`file:` сохраняется), прочее — как есть. Bun
   * разрешает относительный путь от корня — и в зависимости, и в
   * `overrides`: проект переносится вместе с tarball без правок.
   */
  static portable(
    spec: string,
    root: string,
    paths: typeof path = path,
  ): string {
    const file = spec.startsWith('file:');
    const target = file ? spec.slice('file:'.length) : spec;
    if (target === '' || !paths.isAbsolute(target)) return spec;
    const rel = paths.relative(root, target);
    // Другой диск (Windows): относительного пути нет — как есть.
    if (paths.isAbsolute(rel)) return spec;
    const posix = rel.split(paths.sep).join('/');
    const dotted = posix.startsWith('../') ? posix : `./${posix}`;
    return file ? `file:${dotted}` : dotted;
  }

  /** `overrides.<name>`, если это строка; иначе undefined. */
  override(name: string): string | undefined {
    const overrides = this.data.overrides;
    const spec = isObject(overrides) ? overrides[name] : undefined;
    return typeof spec === 'string' ? spec : undefined;
  }

  /**
   * Копия с другим спецификатором `name`: в секции зависимостей, где она
   * есть, и в `overrides`, если он там задан.
   */
  withSpec(name: string, spec: string): ProjectManifest {
    const data: JsonObject = structuredClone(this.data);
    for (const section of DEPENDENCY_SECTIONS) {
      const deps = data[section];
      if (isObject(deps) && typeof deps[name] === 'string') {
        deps[name] = spec;
        break;
      }
    }
    const overrides = data.overrides;
    if (isObject(overrides) && typeof overrides[name] === 'string') {
      overrides[name] = spec;
    }
    return new ProjectManifest(data);
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
