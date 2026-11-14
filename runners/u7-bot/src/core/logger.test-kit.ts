import { mock } from 'bun:test';
import type { Logger } from '@u7-scl/core/shared';

/** `Logger` из `mock`-функций: тесты проверяют `toHaveBeenCalled*`. */
export function mockLogger(): Logger & {
  setLogLevel: ReturnType<typeof mock>;
} {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    setLogLevel: mock(() => {}),
    getLogLevel: mock(() => 0),
    setSourceLevel: mock(() => {}),
  } as unknown as Logger & { setLogLevel: ReturnType<typeof mock> };
}
