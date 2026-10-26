import type { Timestamp } from '#core/kernel/time/timestamp';
import type { EventBus } from './events/event-bus';
import type { Inbox } from './events/inbox';
import type { Outbox } from './events/outbox';
import type { ModuleFacades } from './facade/module-facades';
import type { OperationLog } from './oplog/operation-record';

/** Режим запуска приложения. */
export type AppMode = 'test' | 'development' | 'production';

/** Порт логгера: платформе нужны только записи, уровнями управляет потребитель. */
export type Logger = {
  debug(source: string, message: string, meta?: Record<string, unknown>): void;
  info(source: string, message: string, meta?: Record<string, unknown>): void;
  warn(source: string, message: string, meta?: Record<string, unknown>): void;
  error(source: string, message: string, meta?: Record<string, unknown>): void;
};

/**
 * Часы приложения: текущий момент (мс UTC). Читает только прикладной слой;
 * домен получает время аргументом операции (D-34).
 */
export type Clock = () => Timestamp;

/** Системные часы. */
export const systemClock: Clock = () => Date.now();

/** Платформенные зависимости приложения, общие для всех модулей DMG. */
export type AppContext = {
  /** Шина: подписка реакций; публикует в неё outbox (relay). */
  readonly bus: EventBus;
  /** Куда UoW отдаёт конверты записанных агрегатов (D-47); in-proc — `InProcOutbox`. */
  readonly outbox: Outbox;
  /** Отсев повторной доставки событий реакциям (D-47); in-proc — `InProcInbox`. */
  readonly inbox: Inbox;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly mode: AppMode;
  /** Лог операций UC/ER/Job (D-43, Р6); в приложении — JSONL по дням. */
  readonly oplog: OperationLog;
};

/**
 * Резолвер модуля DMG: платформа и фасады модулей из `dependsOn` (у модуля
 * без зависимостей — пустой `ModuleFacades`); модуль расширяет его
 * репозиториями.
 */
export type ModuleDeps = {
  readonly app: AppContext;
  readonly facades: ModuleFacades;
};
