import type { AnyUseCaseDef, InputOf } from './use-case-def.types';

declare const def: unique symbol;

/** Расширение команды без смены протокола (transport.md §2). */
export type CommandMeta = {
  /**
   * Одно намерение клиента: клиент создаёт его один раз и повторяет при
   * ретраях — это и след, и ключ идемпотентности command UC (transport.md §2).
   */
  readonly requestId?: string;
  readonly version?: number;
};

/**
 * Команда UC — простые данные (D-49): `uc` — имя Def, модуль адресует
 * транспорт. `D` фантомный: только тип, в данных его нет; по нему клиент
 * выводит вход, выход и ошибки.
 */
export type Command<D extends AnyUseCaseDef = AnyUseCaseDef> = {
  readonly uc: D['name'];
  readonly input: InputOf<D>;
  readonly meta?: CommandMeta;
  readonly [def]?: D;
};

/** Def, из которого собрана команда. */
export type DefOfCommand<C> = C extends Command<infer D> ? D : never;
