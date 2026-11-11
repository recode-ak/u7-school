/**
 * Preload `bun test` (bunfig.toml): точка входа тестов.
 *
 * ConsoleLogger в тестах — с уровня WARN: INFO-логи каждого UC
 * («Обработан запрос …») иначе дают тысячи строк вывода. Подробные логи
 * для отладки — `LOG_LEVEL=debug bun test …`.
 */

import { ConsoleLogger, LogLevel, parseLogLevel } from '@u7-scl/core/shared';

ConsoleLogger.defaultLevel =
  parseLogLevel(process.env.LOG_LEVEL ?? '') ?? LogLevel.WARN;
