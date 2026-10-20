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
  testAppContext,
} from './app-context';
export { resetNow, setNow } from './clock';
export { ExampleArch } from './example/example.arch';
export { expectErr, expectOk } from './expect-result';
