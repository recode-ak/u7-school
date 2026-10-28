/** Пакет workspaces прикладного слоя модуля (`gen.package`). */
export type ModulePackage = {
  /** Каталог пакета: каталог прикладного слоя без `/src`. */
  readonly dir: string;
  /** Имя пакета модуля. */
  readonly name: string;
  /** Пакет домена — из `gen.domainImport` (`@acme/domain/{m}` → `@acme/domain`). */
  readonly domain: string;
  /** Путь от каталога пакета к корню проекта (`../..`) — для `extends` tsconfig. */
  readonly root: string;
};
