/**
 * Настройки субагентов pi: `.pi/subagent.json`.
 *
 *   { "model": "deepseek/deepseek-flash" }
 *
 * Модель субагента: `model.pi` в роли → `model` отсюда → модель сессии.
 * Файл читается при каждом вызове, правка действует без перезапуска pi.
 * Импортируется расширением `.pi/extensions/subagent/`; pi работает под Node,
 * поэтому без Bun API.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CONFIG_FILE = 'subagent.json';

/** Модель субагентов из `<piDir>/subagent.json`; нет файла или поля — undefined */
export function readSubagentModel(piDir: string): string | undefined {
  const file = join(piDir, CONFIG_FILE);
  if (!existsSync(file)) return undefined;
  let config: { model?: unknown };
  try {
    config = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: не JSON — ${(e as Error).message}`);
  }
  if (config.model === undefined) return undefined;
  if (typeof config.model !== 'string') {
    throw new Error(`${file}: model должен быть строкой`);
  }
  return config.model;
}
