/**
 * Оболочка Т15: структурные типы ошибок метатипов команд до Ф3.
 * Рантайм-ошибки — `questionnaire.errors.ts` (Def `QUESTIONNAIRE`).
 */

/** Анкета не найдена. */
export type QuestionnaireNotFoundUcError = {
  name: 'QUESTIONNAIRE_NOT_FOUND';
  level: 'domain';
  kind: 'not-found';
  message: string;
  payload: { uuid: string } | undefined;
};

/** Доступ запрещён. */
export type AccessDeniedUcError = {
  name: 'ACCESS_DENIED';
  level: 'domain';
  kind: 'access-denied';
  message: string;
  payload: undefined;
};

/** Некорректный запрос. */
export type BadRequestUcError = {
  name: 'BAD_REQUEST';
  level: 'api';
  kind: 'bad-request';
  message: string;
  payload: unknown;
};

/** Внутренняя ошибка. */
export type InternalUcError = {
  name: 'INTERNAL_ERROR';
  level: 'api';
  kind: 'internal';
  message: string;
  payload: unknown;
};

/** У пользователя уже есть активная анкета. */
export type QuestionnaireActiveUcError = {
  name: 'QUESTIONNAIRE_ACTIVE';
  level: 'domain';
  kind: 'conflict';
  message: string;
  payload: { userId: string } | undefined;
};

/** Любая известная ошибка модуля questionnaire. */
export type QuestionnaireModuleError =
  | QuestionnaireNotFoundUcError
  | QuestionnaireActiveUcError
  | BadRequestUcError
  | InternalUcError
  | AccessDeniedUcError;
