import type { EventBus as LegacyBus } from '@u7-scl/core/domain';
import { legacyClock, legacyEventBus } from '@u7-scl/core/legacy-bridge';
import type { Logger } from '@u7-scl/core/shared';
import { type CourseLegacy, createCourseModule } from '@u7-scl/course';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { WishModuleDef } from '@u7-scl/domain/wish/contract';
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
import type { Identified } from 'dmg-core';
import {
  ApiApp,
  type AppContext,
  type AppMode,
  InProcInbox,
  InProcOutbox,
  InProcReplayStore,
  JsonlOperationLog,
  type ModuleFactory,
  type ReplayStore,
} from 'dmg-core/app';

/** Платформа DMG поверх legacy-приложения: шина, логгер, режим, каталог лога операций. */
export type DmgPlatform = {
  readonly legacyBus: LegacyBus;
  readonly logger: Logger;
  readonly mode: AppMode;
  /** Каталог лога операций — `<DB_DIR>/oplog` (TR-13 п. 10), в тестах — временный. */
  readonly oplogDir: string;
  /** Отсев повторов команд (D-56); не задан — в памяти процесса. Бот — файловый `<DB_DIR>/replay`. */
  readonly replay?: ReplayStore;
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
 * приложения, JSONL-лог операций, отсев повторов команд (D-56) —
 * переданный или в памяти.
 */
export function createDmgAppContext(platform: DmgPlatform): AppContext {
  const { legacyBus, logger, mode, oplogDir, replay } = platform;
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
    replay: replay ?? new InProcReplayStore({ clock }),
  };
}

// DEBT-39: сборка модулей в раннере, а не в пакете приложения (D-50).
/**
 * Приложение DMG: внешние модули зависимостей (адаптеры над legacy-фасадами,
 * TR-11) и `wish`, собранные `ApiApp` пакета — фасады по `dependsOn`
 * (D-50). `modules` — их Def для заданий legacy-планировщика
 * (`ApiApp.withDmg`).
 */
export function createDmgApp(
  app: AppContext,
  legacy: DmgLegacyFacades,
  wishes: WishRepo,
) {
  const factories: ModuleFactory<Identified>[] = [
    {
      def: UserModuleDef,
      create: (deps) => createUserModule({ ...deps, legacy: legacy.user }),
    },
    {
      def: CourseModuleDef,
      create: (deps) => createCourseModule({ ...deps, legacy: legacy.course }),
    },
    {
      def: QuestionnaireModuleDef,
      create: (deps) =>
        createQuestionnaireModule({ ...deps, legacy: legacy.questionnaire }),
    },
    {
      def: StreamModuleDef,
      create: (deps) => createStreamModule({ ...deps, legacy: legacy.stream }),
    },
    {
      def: WishModuleDef,
      create: (deps) => createWishModule({ ...deps, wishes }),
    },
  ];
  return {
    api: new ApiApp<Identified>(app, factories),
    modules: factories.map((f) => f.def),
  };
}
