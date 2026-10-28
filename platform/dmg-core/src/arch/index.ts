// dmg-core/arch — контрактные проверки архитектуры (`bun run arch:check`).

export { type ArchApp, ArchChecker } from './arch-checker';
export {
  type ArchReportOptions,
  RULES_DOC,
  reportArchCheck,
} from './arch-report';
export type { ModuleLayout } from './file-checker';
export { type ArchRule, Violation } from './violation';
