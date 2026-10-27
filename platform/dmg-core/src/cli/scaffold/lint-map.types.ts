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
