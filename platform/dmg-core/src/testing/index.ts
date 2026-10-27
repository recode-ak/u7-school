// Тестовые хелперы платформы DMG: dmg-core/testing.

export {
  MemoryTasks,
  OWNER,
  T0,
  TASK,
  TASK_2,
  taskRow,
} from '../app/app.fixture';
export { TEST_NOW, testAppContext } from './app-context';
export { ExampleArch } from './example/example.arch';
export { expectErr, expectOk } from './expect-result';
export { MemoryBus, RecordingBus } from './memory-bus';
export { type LogRecord, MemoryLogger } from './memory-logger';
export { MemoryOperationLog } from './memory-operation-log';
export {
  expectIdempotentReaction,
  type ReactionIdempotencySpec,
} from './reaction-idempotency';
export { type StubCall, StubFacade } from './stub-facade';
