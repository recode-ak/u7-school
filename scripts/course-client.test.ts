import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { warnOnlyLogger } from './_course-client';

// Ф4а, сценарий 11. `CourseClient` в режиме `silent` скрывает служебные логи
// модулей, но пропуск неопубликованного при сборке снимка (`logger.warn`)
// оператор скрипта должен видеть. Предполагаемый контракт: `_course-client.ts`
// экспортирует `warnOnlyLogger` (`Logger`), который `silent` подставляет
// вместо no-op логгера; warn уходит в `console.warn`, остальное молчит.

let warn: ReturnType<typeof spyOn>;
let log: ReturnType<typeof spyOn>;
let error: ReturnType<typeof spyOn>;
beforeEach(() => {
  warn = spyOn(console, 'warn').mockImplementation(() => {});
  log = spyOn(console, 'log').mockImplementation(() => {});
  error = spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  log.mockRestore();
  error.mockRestore();
});

describe('warnOnlyLogger', () => {
  it('warn выводится: источник и сообщение видны оператору', () => {
    warnOnlyLogger.warn('getModuleSnapshot', 'шаг пропущен: stepId=abc');

    expect(warn).toHaveBeenCalledTimes(1);
    const printed = String(warn.mock.calls[0]?.join(' '));
    expect(printed).toContain('getModuleSnapshot');
    expect(printed).toContain('шаг пропущен: stepId=abc');
  });

  it('info и debug молчат', () => {
    warnOnlyLogger.info('src', 'служебное');
    warnOnlyLogger.debug('src', 'отладка');

    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
