import { describe, expect, expectTypeOf, it } from 'bun:test';
import * as v from 'valibot';
import { Def } from '#core/kernel/def/def';
import { ErrorDef } from '#core/kernel/errors/error-def';
import { BaseEntityFields, F } from '#core/kernel/fields/fields';
import { toJsonSchema } from '#core/kernel/schema/json-schema';
import { EventDef } from '../events/event-def';
import type { TransitionOf } from './aggregate.types';
import { AggregateDef, type AnyAggregateDef } from './aggregate-def';

const NoteState = v.object({
  ...BaseEntityFields,
  status: F.picklist(['draft', 'closed'], 'Статус'),
});

const NoteEvents = EventDef.define('notes.note', {
  closed: {
    label: 'Закрыта',
    description: 'Заметка закрыта.',
    payload: v.object({ noteId: v.string() }),
  },
});

const NoteErrors = ErrorDef.define('NOTE', {
  CLOSED: { kind: 'conflict', label: 'Закрыта', description: 'Уже закрыта.' },
});

const NoteArDef = AggregateDef.define({
  name: 'note',
  label: 'Заметка',
  description: 'Заметка со статусом.',
  state: NoteState,
  statuses: { draft: { label: 'Черновик' }, closed: { label: 'Закрыта' } },
  transitions: {
    close: {
      from: ['draft'],
      to: 'closed',
      rejects: { closed: NoteErrors.CLOSED },
    },
  },
  events: NoteEvents,
  errors: NoteErrors,
});

/** Агрегат без статусов: жизненного цикла нет. */
const TagArDef = AggregateDef.define({
  name: 'tag',
  label: 'Метка',
  description: 'Метка заметки.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: {},
});

describe('AggregateDef', () => {
  it('экземпляр вида с полями спеки', () => {
    expect(NoteArDef).toBeInstanceOf(AggregateDef);
    expect(NoteArDef).toBeInstanceOf(Def);
    expect(NoteArDef.dmg).toBe('aggregate');
    expect(NoteArDef.name).toBe('note');
    expect(NoteArDef.statuses.closed.label).toBe('Закрыта');
    expect(NoteArDef.transitions.close.to).toBe('closed');
    expect(NoteArDef.events).toBe(NoteEvents);
    expect(NoteArDef.errors).toBe(NoteErrors);
  });

  it('без статусов — statuses и transitions не объявлены', () => {
    expect(TagArDef.statuses).toBeUndefined();
    expect(TagArDef.transitions).toBeUndefined();
    expectTypeOf<TransitionOf<typeof TagArDef>>().toEqualTypeOf<never>();
    expectTypeOf<TransitionOf<typeof NoteArDef>>().toEqualTypeOf<'close'>();
  });

  it('state читает запись без updatedAt как updatedAt = createdAt', () => {
    const at = Date.UTC(2026, 0, 1);
    const parsed = v.parse(NoteArDef.state, {
      uuid: '00000000-0000-4000-8000-000000000001',
      createdAt: at,
      version: 1,
      status: 'draft',
    });
    expect(parsed.updatedAt).toBe(at);
    expect(NoteArDef.state.entries).toBe(NoteState.entries);
  });

  it('переход объявляет отказ для каждого статуса вне `from`', () => {
    AggregateDef.define({
      name: 'note',
      label: 'Заметка',
      description: 'Заметка со статусом.',
      state: NoteState,
      statuses: { draft: { label: 'Черновик' }, closed: { label: 'Закрыта' } },
      transitions: {
        // @ts-expect-error нет отказа для статуса `closed`
        close: { from: ['draft'], to: 'closed', rejects: {} },
      },
      events: NoteEvents,
      errors: NoteErrors,
    });
  });

  it('normalize() — схема state, переходы с кодами отказов, имена групп', () => {
    expect(NoteArDef.normalize()).toEqual({
      dmg: 'aggregate',
      name: 'note',
      label: 'Заметка',
      description: 'Заметка со статусом.',
      state: toJsonSchema(NoteArDef.state),
      statuses: { draft: { label: 'Черновик' }, closed: { label: 'Закрыта' } },
      transitions: {
        close: {
          from: ['draft'],
          to: 'closed',
          rejects: { closed: 'NOTE_CLOSED' },
        },
      },
      events: ['notes.note.closed'],
      errors: ['NOTE_CLOSED'],
    });
    expect(TagArDef.normalize().transitions).toBeUndefined();
  });

  it('describe() — схема state', () => {
    expect(NoteArDef.describe().schemas).toEqual([['state', NoteArDef.state]]);
  });

  it('конкретный Def совместим с AnyAggregateDef', () => {
    expectTypeOf(NoteArDef).toExtend<AnyAggregateDef>();
    expectTypeOf(TagArDef).toExtend<AnyAggregateDef>();
  });
});
