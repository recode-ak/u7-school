import type { AnyUseCaseDef, InputOf } from './use-case-def.types';

declare const def: unique symbol;

/** Расширение команды без смены протокола (transport.md §2). */
export type CommandMeta = {
  readonly requestId?: string;
  readonly version?: number;
  /** Ключ идемпотентности: повтор с тем же ключом не исполняется дважды. */
  readonly idempotencyKey?: string;
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
