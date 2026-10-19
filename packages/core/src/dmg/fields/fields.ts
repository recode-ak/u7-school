import * as v from 'valibot';
import type { Timestamp } from '../time/timestamp';

const ZONE = /([zZ]|[+-]\d{2}:?\d{2})$/;

// Legacy-даты (`YYYY-MM-DDTHH:mm`) хранились в UTC без зоны.
function parseIso(value: string): Timestamp {
  return Date.parse(ZONE.test(value) ? value : `${value}Z`);
}

function timestamp(label: string) {
  return v.pipe(
    v.union([
      v.pipe(v.number(), v.integer()),
      v.pipe(v.string(), v.isoDateTime()),
      v.pipe(v.string(), v.isoTimestamp()),
    ]),
    v.description(`Время ${label}`),
    v.transform(
      (value): Timestamp =>
        typeof value === 'number' ? value : parseIso(value),
    ),
  );
}

function uuid(label: string) {
  return v.pipe(v.string(), v.uuid(), v.description(`Идентификатор ${label}`));
}

function string(label: string) {
  return v.pipe(v.string(), v.nonEmpty(), v.description(label));
}

function int(label: string) {
  return v.pipe(v.number(), v.integer(), v.description(label));
}

function boolean(label: string) {
  return v.pipe(v.boolean(), v.description(label));
}

function picklist<const T extends readonly [string, ...string[]]>(
  options: T,
  label: string,
) {
  return v.pipe(v.picklist(options), v.description(label));
}

/**
 * Базовые поля схем (DOM-11): описание ставится из метки.
 * `uuid` и `timestamp` принимают метку в родительном падеже: `F.uuid('задачи')`.
 */
export const F = { uuid, timestamp, string, int, boolean, picklist };

/** Поля, общие для всех entity. */
export const BaseEntityFields = {
  uuid: uuid('сущности'),
  createdAt: timestamp('создания'),
  updatedAt: timestamp('изменения'),
};
