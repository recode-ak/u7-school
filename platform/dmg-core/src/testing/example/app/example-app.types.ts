import type { AppMode, Clock, Logger } from '#core/app/context';
import type { EventBus } from '#core/app/events/event-bus';

/**
 * Окружение учебного приложения (D-50) — простые данные: раннер собирает
 * их из `process.env`, приложение само окружение не читает (ARC-09).
 */
export type ExampleAppEnv = {
  readonly mode: AppMode;
  /** Каталог данных: задачи — `tasks.json`, лог операций — `oplog/`. */
  readonly dataDir: string;
  /** uuid активных пользователей при старте (`users` хранит их в памяти). */
  readonly users: readonly string[];
};

/**
 * Подмена портов контекста — для тестов и встраивания. Не задан — боевой:
 * `InProcEventBus`, `ConsoleLogger`, `systemClock`.
 */
export type ExampleAppPorts = {
  readonly bus?: EventBus;
  readonly logger?: Logger;
  readonly clock?: Clock;
};
