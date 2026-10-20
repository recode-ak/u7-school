import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { toJsonSchema } from '../schema/json-schema';
import { BaseEntityFields, F } from './fields';

const UUID = '0b6f8a52-3c1e-4d5a-9a43-1f7e2b9c8d10';

function descriptionOf(schema: v.GenericSchema): string | undefined {
  return v.getDescription(schema);
}

describe('F.timestamp', () => {
  const field = F.timestamp('создания');

  it('читает число как есть', () => {
    expect(v.parse(field, 1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('читает legacy ISO без зоны как UTC', () => {
    expect(v.parse(field, '2026-10-19T10:00')).toBe(
      Date.UTC(2026, 9, 19, 10, 0),
    );
  });

  it('читает полный ISO с зоной', () => {
    expect(v.parse(field, '2026-10-19T10:00:00.000Z')).toBe(
      Date.UTC(2026, 9, 19, 10, 0),
    );
  });

  it('отклоняет мусор', () => {
    expect(v.safeParse(field, 'вчера').success).toBe(false);
  });

  it('описание из метки', () => {
    expect(descriptionOf(field)).toBe('Время создания');
  });
});

describe('F.uuid', () => {
  it('принимает UUID, отклоняет прочее, описание из метки', () => {
    const field = F.uuid('задачи');
    expect(v.parse(field, UUID)).toBe(UUID);
    expect(v.safeParse(field, 'x').success).toBe(false);
    expect(descriptionOf(field)).toBe('Идентификатор задачи');
  });
});

describe('простые поля', () => {
  it('метка становится описанием', () => {
    expect(descriptionOf(F.string('Название'))).toBe('Название');
    expect(descriptionOf(F.int('Порядок'))).toBe('Порядок');
    expect(descriptionOf(F.boolean('Выполнена'))).toBe('Выполнена');
    expect(descriptionOf(F.picklist(['a', 'b'], 'Статус'))).toBe('Статус');
  });

  it('F.string отклоняет пустую строку, F.int — дробь', () => {
    expect(v.safeParse(F.string('Название'), '').success).toBe(false);
    expect(v.safeParse(F.int('Порядок'), 1.5).success).toBe(false);
  });
});

describe('BaseEntityFields', () => {
  it('uuid, createdAt, updatedAt; version без значения — 0', () => {
    const entity = v.object({ ...BaseEntityFields });
    const parsed = v.parse(entity, {
      uuid: UUID,
      createdAt: '2026-10-19T10:00',
      updatedAt: 5,
    });
    expect(parsed).toEqual({
      uuid: UUID,
      createdAt: Date.UTC(2026, 9, 19, 10, 0),
      updatedAt: 5,
      version: 0,
    });
  });
});

describe('JSON Schema', () => {
  it('все поля конвертируются, описания сохраняются', () => {
    const schema = v.object({
      ...BaseEntityFields,
      title: F.string('Название'),
      order: F.int('Порядок'),
      done: F.boolean('Выполнена'),
      status: F.picklist(['open', 'closed'], 'Статус'),
    });
    const json = toJsonSchema(schema);
    expect(json.properties?.createdAt).toMatchObject({
      description: 'Время создания',
    });
    expect(json.properties?.uuid).toMatchObject({ format: 'uuid' });
  });
});
