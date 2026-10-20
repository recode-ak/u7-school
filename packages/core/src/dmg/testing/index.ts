// Тестовые хелперы платформы DMG: @u7-scl/core/dmg/testing.

export {
  type LogRecord,
  memoryBus,
  memoryLogger,
  recordingBus,
  testAppContext,
} from './app-context';
export { resetNow, setNow } from './clock';
export { ExampleArch } from './example/example.arch';
export { expectErr, expectOk } from './expect-result';
