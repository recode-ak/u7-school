import type { EventBus as LegacyBus } from '@u7-scl/core/domain';
import { legacyClock, legacyEventBus } from '@u7-scl/core/legacy-bridge';
import type { Logger } from '@u7-scl/core/shared';
import { type CourseLegacy, createCourseModule } from '@u7-scl/course';
import {
  createQuestionnaireModule,
  type QuestionnaireLegacy,
  questionnaireLegacyInbound,
} from '@u7-scl/questionnaire';
import {
  createStreamModule,
  type StreamLegacy,
  streamLegacyInbound,
} from '@u7-scl/stream';
import { createUserModule, type UserLegacy } from '@u7-scl/user';
import { createWishModule } from '@u7-scl/wish';
import type { WishRepo } from '@u7-scl/wish/wish';
import {
  type AppContext,
  type AppMode,
  InProcInbox,
  InProcOutbox,
  InProcReplayStore,
  JsonlOperationLog,
  ModuleFacade,
  ModuleFacades,
} from 'dmg-core/app';

/** Платформа DMG поверх legacy-приложения: шина, логгер, режим, каталог лога операций. */
export type DmgPlatform = {
  readonly legacyBus: LegacyBus;
  readonly logger: Logger;
  readonly mode: AppMode;
  /** Каталог лога операций — `<DB_DIR>/oplog` (TR-13 п. 10), в тестах — временный. */
  readonly oplogDir: string;
};

/** Legacy-фасады, над которыми собраны внешние DMG-модули зависимостей (TR-11). */
export type DmgLegacyFacades = {
  readonly user: UserLegacy;
  readonly course: CourseLegacy;
  readonly questionnaire: QuestionnaireLegacy;
  readonly stream: StreamLegacy;
};

/**
 * Контекст приложения для модулей DMG на время сосуществования: шина DMG
 * поверх legacy-шины (входящие legacy-события зависимостей — по картам
 * `inbound`, D-37), outbox и inbox в процессе (D-47), часы legacy, логгер
 * приложения, JSONL-лог операций, отсев повторов команд в памяти (D-56).
 */
export function createDmgAppContext(platform: DmgPlatform): AppContext {
  const { legacyBus, logger, mode, oplogDir } = platform;
  const bus = legacyEventBus(legacyBus, {
    inbound: [...streamLegacyInbound, ...questionnaireLegacyInbound],
    onInvalid: (message) => logger.warn('legacy-event-bus', message),
  });
  const clock = legacyClock();
  return {
    bus,
    outbox: new InProcOutbox(bus),
    inbox: new InProcInbox(),
    clock,
    logger,
    mode,
    oplog: new JsonlOperationLog(oplogDir),
    replay: new InProcReplayStore({ clock }),
  };
}

// DEBT-39: сборка модулей в раннере, а не в пакете приложения (D-50).
/**
 * Модули DMG приложения: внешние модули зависимостей (адаптеры над
 * legacy-фасадами, TR-11) и `wish`. Фасады — по `dependsOn` модуля `wish`
 * (D-43); у адаптеров зависимостей нет.
 */
export function createDmgModules(
  app: AppContext,
  legacy: DmgLegacyFacades,
  wishes: WishRepo,
) {
  const none = new ModuleFacades();
  const user = createUserModule({ app, facades: none, legacy: legacy.user });
  const course = createCourseModule({
    app,
    facades: none,
    legacy: legacy.course,
  });
  const questionnaire = createQuestionnaireModule({
    app,
    facades: none,
    legacy: legacy.questionnaire,
  });
  const stream = createStreamModule({
    app,
    facades: none,
    legacy: legacy.stream,
  });
  const wish = createWishModule({
    app,
    facades: new ModuleFacades([
      new ModuleFacade(user),
      new ModuleFacade(course),
      new ModuleFacade(questionnaire),
      new ModuleFacade(stream),
    ]),
    wishes,
  });
  return [user, course, questionnaire, stream, wish] as const;
}
