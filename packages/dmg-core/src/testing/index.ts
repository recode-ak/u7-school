// Тестовые хелперы платформы DMG: dmg-core/testing.

export {
  MemoryTasks,
  OWNER,
  T0,
  TASK,
  TASK_2,
  taskRow,
} from '../app/app.fixture';
export {
  type LogRecord,
  memoryBus,
  memoryLogger,
  recordingBus,
  TEST_NOW,
  testAppContext,
} from './app-context';
export { ExampleArch } from './example/example.arch';
export { expectErr, expectOk } from './expect-result';
export { MemoryOperationLog } from './memory-operation-log';
export { type StubCall, StubFacade } from './stub-facade';
