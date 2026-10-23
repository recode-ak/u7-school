import type {
  GetCoursesIncludingModuleUcDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import type { InputOf, OutputOf } from 'dmg-core';

/**
 * Вопросы к модулю курсов о зачислении — готовые входы его UC. Вопроса нет,
 * если спрашивать не о чем: вызывающий не обращается к курсу.
 */
export type FulfillmentQuestion = {
  readonly courses?: InputOf<typeof GetCoursesIncludingModuleUcDef>;
  readonly modules?: InputOf<typeof GetSameModulesUcDef>;
};

/** Ответы модуля курсов на `FulfillmentQuestion`: на заданные вопросы. */
export type FulfillmentAnswer = {
  readonly courses?: OutputOf<typeof GetCoursesIncludingModuleUcDef>;
  readonly modules?: OutputOf<typeof GetSameModulesUcDef>;
};
