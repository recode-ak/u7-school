import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { BaseEntityFields } from '#core/kernel/fields/fields';
import { ok, type Result } from '#core/kernel/result/result';
import { Aggregate } from './aggregate';
import type { StateOf } from './aggregate.types';
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
const ID_2 = '0d8f3a2b-6c1e-4f7a-8b9d-5e4c3b2a1f00';
const note = (uuid: string, pinned = false): StateOf<typeof NoteDef> => ({
  uuid,
  createdAt: 0,
  updatedAt: 0,
  version: 0,
  pinned,
});
const view: ReadonlyAr<NoteAr> = NoteAr.restore(note(ID));

describe('ReadonlyAr', () => {
  it('идентификаторы и вопросы доступны', () => {
    expect(view.uuid).toBe(ID);
    expect(view.isPinned()).toBe(false);
  });

  it('view() доступен — это чтение (D-44)', () => {
    expect(view.view()).toEqual(note(ID));
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

describe('Aggregate.readonly (D-43, Р7)', () => {
  it('state → ReadonlyAr конкретного Ar через его restore', () => {
    const value: ReadonlyAr<NoteAr> = NoteAr.readonly(note(ID));
    expect(value).toBeInstanceOf(NoteAr);
    expect([value.uuid, value.isPinned()]).toEqual([ID, false]);
    // @ts-expect-error мутирующий метод скрыт (ReadonlyAr)
    expect(typeof value.pin).toBe('function');
  });

  it('список state — по одному', () => {
    const notes = [note(ID), note(ID_2, true)].map((s) => NoteAr.readonly(s));
    expect(notes.map((n) => [n.uuid, n.isPinned()])).toEqual([
      [ID, false],
      [ID_2, true],
    ]);
  });

  it('state не по схеме Def — исключение restore', () => {
    const broken = { ...note(ID), pinned: 'да' } as never;
    expect(() => NoteAr.readonly(broken)).toThrow('не прошло схему');
  });

  it('state другого агрегата — ошибка компиляции', () => {
    // @ts-expect-error restore NoteAr ждёт state заметки
    const wrong = () => NoteAr.readonly({ uuid: ID });
    expect(wrong).toBeDefined();
  });
});
