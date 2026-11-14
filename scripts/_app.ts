/**
 * `_app.ts` — сборка приложения для скриптов, вызывающих UC от имени администратора.
 *
 * Корень сборки `U7App` (D-50) над каталогом данных, субъект — администратор
 * Nur из резолвера приложения (гость недопустим: он видел бы не то, что
 * администратор), вызов — `dispatch` (D-49). Таймеры job'ов не запускаются.
 */
import { TEST_SCHOOL, U7App } from '@u7-scl/app';
import type { Logger } from '@u7-scl/core/shared';
import {
  type AnyModuleDef,
  type AnyUseCaseDef,
  type InputOf,
  type OutputOf,
  type Result,
  UseCaseDef,
} from 'dmg-core';
import { Trace } from 'dmg-core/app';

/** UUID автора-ментора (Нур) — субъект запросов скриптов (`call-uc` тоже). */
export const NUR_UUID = '8d9a56f6-51e7-49f0-ba58-2832b157e718';

/** Субъект запросов: администратор из резолвера приложения. */
type AdminCaller = Extract<
  Awaited<ReturnType<U7App['callers']['resolve']>>,
  { kind: 'user' }
>;

/** Отказ UC: то, что скрипту нужно для сообщения оператору. */
export type UcRejection = { code: string; label: string; payload?: unknown };

/** Приложение и субъект администратора: один экземпляр на запуск скрипта. */
export class ScriptApp {
  private constructor(
    private readonly app: U7App,
    private readonly caller: AdminCaller,
    private readonly trace: Trace,
  ) {}

  /**
   * Собирает приложение над каталогом `dbDir` (по умолчанию `DB_DIR` или
   * `data`). Нет пользователя `NUR_UUID` в каталоге — исключение.
   */
  static async create(
    options: { dbDir?: string; logger?: Logger } = {},
  ): Promise<ScriptApp> {
    const dbDir = options.dbDir ?? process.env.DB_DIR ?? 'data';
    const app = new U7App(
      {
        mode: 'development',
        dbDir,
        communityGroup: TEST_SCHOOL.communityGroup,
        studentGroup: TEST_SCHOOL.studentGroup,
        mentors: [...TEST_SCHOOL.mentors],
      },
      options.logger ? { logger: options.logger } : {},
    );
    const trace = Trace.fromRequest({
      requestId: crypto.randomUUID(),
      channel: { name: 'cli' },
    });
    const caller = await app.callers.resolve(NUR_UUID, trace);
    if (caller.kind !== 'user') {
      throw new Error(
        `пользователь ${NUR_UUID} не найден в ${dbDir}/users/users.json: ` +
          'скрипт работает от имени администратора, гостевой субъект недопустим',
      );
    }
    return new ScriptApp(app, caller, trace);
  }

  /** Вызов UC модуля через `dispatch`: `Result` с кодом отказа, без исключений. */
  async run<M extends AnyModuleDef, D extends M['useCases'][number]>(
    moduleDef: M,
    ucDef: D,
    input: InputOf<D>,
  ): Promise<Result<OutputOf<D>, UcRejection>> {
    const res = await this.app.apiApp.dispatch(
      moduleDef,
      UseCaseDef.commandOf(ucDef as AnyUseCaseDef, input as never),
      this.caller,
      this.trace,
    );
    return res as Result<OutputOf<D>, UcRejection>;
  }
}
