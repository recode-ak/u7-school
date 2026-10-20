import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { BaseEntityFields } from '#core/kernel/fields/fields';
import { ok, type Result } from '#core/kernel/result/result';
import { Aggregate, type StateOf } from './aggregate';
import { defineAggregate } from './define-aggregate';
import type { ReadonlyAr } from './readonly-ar';

const NoteDef = defineAggregate({
  name: 'note',
  label: 'Заметка',
  description: 'Заметка без статусов.',
  state: v.object({ ...BaseEntityFields, pinned: v.boolean() }),
  events: {},
  errors: {},
});

class NoteAr extends Aggregate<typeof NoteDef> {
  private constructor(state: StateOf<typeof NoteDef>) {
    super(NoteDef, state);
  }

  static restore(snapshot: StateOf<typeof NoteDef>): NoteAr {
    return new NoteAr(snapshot);
  }

  pin(at: number): Result<void, never> {
    return this.change(at, (draft) => {
      draft.pinned = true;
      return ok();
    });
  }

  isPinned(): boolean {
    return this.state.pinned;
  }
}

const ID = '7b0c1f5e-4a5b-4c8e-9a51-2f6d3e8b9c10';
const view: ReadonlyAr<NoteAr> = NoteAr.restore({
  uuid: ID,
  createdAt: 0,
  updatedAt: 0,
  pinned: false,
});

describe('ReadonlyAr', () => {
  it('идентификаторы и вопросы доступны', () => {
    expect(view.uuid).toBe(ID);
    expect(view.isPinned()).toBe(false);
  });

  it('мутирующие методы, снимок и выдача событий недоступны', () => {
    // @ts-expect-error мутирующий метод (возвращает Result)
    view.pin;
    // @ts-expect-error снимок — entity, только для репозитория
    view.snapshot;
    // @ts-expect-error события выдаёт только UoW
    view.pullEvents;
    expect(view.isPinned()).toBe(false);
  });
});
