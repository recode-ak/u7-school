/**
 * Порт вывода CLI: строки в stdout и stderr. Точка входа отдаёт `console`,
 * тест — буфер; глобальные `console` и `process` раннер не трогает.
 */
export type CliIo = {
  out(line: string): void;
  err(line: string): void;
};
