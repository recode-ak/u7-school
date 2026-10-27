/**
 * Каталоги приложения вне модулей (D-52): корень сборки (`root`) и раннеры
 * (`runners`). Файлы прикладных пакетов модулей и раннеров внутри `root`
 * к корню сборки не относятся.
 */
export type AssemblyPlaces = {
  readonly root?: string;
  readonly runners?: readonly string[];
};
