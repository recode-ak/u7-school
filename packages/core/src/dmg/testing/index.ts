// Тестовые хелперы платформы DMG: @u7-scl/core/dmg/testing.

export {
  type LogRecord,
  memoryLogger,
  recordingBus,
  testAppContext,
} from './app-context';
export { resetNow, setNow } from './clock';
export { expectErr, expectOk } from './expect-result';
