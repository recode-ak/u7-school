/** Запрет импортов biome: глобы спецификаторов и сообщение с ID правила. */
export type ImportBan = {
  readonly group: readonly string[];
  readonly message: string;
};

/**
 * Строка карты линтера: правило `rules.md` (ID) → каталоги проекта, где оно
 * действует. Проверка — GritQL-плагин пакета (`plugin` — имя файла без
 * `.grit`) или запреты импортов biome (`imports`, `noRestrictedImports`).
 * `includes` — глобы biome от корня проекта; тесты исключаются всегда.
 *
 * biome не сливает `noRestrictedImports` пересекающихся секций: на файле
 * действует последняя. `repeats` — ID строк выше, чьи запреты действуют на
 * тех же файлах: их запреты повторяются в этой секции.
 */
export type LintRule =
  | {
      readonly id: string;
      readonly includes: readonly string[];
      readonly plugin: string;
    }
  | {
      readonly id: string;
      readonly includes: readonly string[];
      readonly imports: readonly ImportBan[];
      readonly repeats?: readonly string[];
    };

/** Секция `overrides` biome.json — JSON-объект. */
export type BiomeOverride = Record<string, unknown>;

/** Каталоги слоёв профиля для карты линтера — глобы biome от корня проекта. */
export type LintDirs = {
  /** Исходники домена. */
  readonly domain: string;
  /** Прикладной слой и корень сборки (DOM-01, кроме `infra`). */
  readonly app: readonly string[];
  /** Исходники всех слоёв (ARC-09, CODE-02, операции и т.д.). */
  readonly sources: readonly string[];
  /** Точка входа раннера — единственное место чтения окружения (ARC-09). */
  readonly main: string;
  /** Каталоги вне домена, куда домен не выходит относительным путём. */
  readonly escapes: readonly string[];
  /** Что за каталоги `escapes` — в сообщение ARC-02. */
  readonly escapesTitle: string;
};
