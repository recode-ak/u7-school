import type { DomainError, ErrorKind } from 'dmg-core';
import type {
  AppError,
  ErrorKind as LegacyKind,
} from '#domain-legacy/errors/errors';

const KINDS: Readonly<Record<ErrorKind, LegacyKind>> = {
  validation: 'validation',
  unauthorized: 'unauthorized',
  access: 'access-denied',
  not_found: 'not-found',
  conflict: 'conflict',
  internal: 'internal',
};

/**
 * Ошибка DMG в форме legacy `AppError` — для `appApi.execute`, пока
 * stories ловят `AppException`. Текст — `denyMessage` правила (отказ
 * Policy) или `label` ошибки.
 */
export function toLegacyError(error: DomainError): AppError {
  const kind = KINDS[error.kind];
  return {
    name: error.code,
    level: kind === 'validation' || kind === 'unauthorized' ? 'api' : 'domain',
    kind,
    message: denyMessageOf(error.payload) ?? error.label,
    payload: error.payload,
  };
}

function denyMessageOf(payload: unknown): string | undefined {
  return typeof payload === 'object' &&
    payload !== null &&
    'denyMessage' in payload &&
    typeof payload.denyMessage === 'string'
    ? payload.denyMessage
    : undefined;
}
