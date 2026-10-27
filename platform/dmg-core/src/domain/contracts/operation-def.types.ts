import type { DefTexts } from '#core/kernel/def/def';
import type { AnyEventReactionDef } from './event-reaction-def.types';
import type { AnyJobDef } from './job-def.types';
import type { AnyUseCaseDef } from './use-case-def.types';

/** Общее в спеке UC, ER и Job: тексты и межмодульные вызовы. */
export type OperationSpec<N extends string = string> = DefTexts<N> & {
  /**
   * UC других модулей (с `'system'` в `callers`), которые операция вызывает
   * через их фасады (D-42, D-43, MAN-05).
   */
  readonly calls?: readonly AnyUseCaseDef[];
};

/** Дискриминатор вида операции. */
export type OperationDmg = 'useCase' | 'eventReaction' | 'job';

/** Сокращение вида в сообщениях проверок: `UC todo.createTask`. */
export type OperationAbbr = 'UC' | 'ER' | 'Job';

/** Каталог и суффикс файла операции: `<агрегат>/uc/<имя>.uc.ts`. */
export type OperationFileKind = 'uc' | 'er' | 'job';

/** Def операции модуля: UC, ER или Job. */
export type AnyOperationDef = AnyUseCaseDef | AnyEventReactionDef | AnyJobDef;
