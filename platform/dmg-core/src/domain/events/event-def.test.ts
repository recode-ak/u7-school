import { describe, expect, expectTypeOf, it } from 'bun:test';
import * as v from 'valibot';
import { Def } from '#core/kernel/def/def';
import { toJsonSchema } from '#core/kernel/schema/json-schema';
import { type AnyEventDef, EventDef, type EventOf } from './event-def';

const TaskEvents = EventDef.define('todo.task', {
  completed: {
    label: 'Задача завершена',
    description: 'Задача отмечена выполненной.',
    payload: v.object({ taskId: v.string() }),
  },
});

describe('EventDef', () => {
  it('define — группа Def-классов, имя = префикс + ключ', () => {
    const def = TaskEvents.completed;
    expect(def).toBeInstanceOf(EventDef);
    expect(def).toBeInstanceOf(Def);
    expect(def.dmg).toBe('event');
    expect(def.name).toBe('todo.task.completed');
    expectTypeOf(def.name).toEqualTypeOf<'todo.task.completed'>();
  });

  it('make() — событие с типизированным payload', () => {
    const e = TaskEvents.completed.make({ taskId: 't1' });
    expect(e).toEqual({
      name: 'todo.task.completed',
      payload: { taskId: 't1' },
    });
    expectTypeOf(e).toEqualTypeOf<EventOf<typeof TaskEvents.completed>>();
    // @ts-expect-error payload не по схеме
    TaskEvents.completed.make({ id: 1 });
  });

  it('normalize() — тексты и JSON Schema payload', () => {
    expect(TaskEvents.completed.normalize()).toEqual({
      dmg: 'event',
      name: 'todo.task.completed',
      label: 'Задача завершена',
      description: 'Задача отмечена выполненной.',
      payload: toJsonSchema(v.object({ taskId: v.string() })),
    });
  });

  it('describe() — схема payload', () => {
    const def = TaskEvents.completed;
    expect(def.describe().schemas).toEqual([['payload', def.payload]]);
  });

  it('конкретный Def совместим с AnyEventDef', () => {
    expectTypeOf(TaskEvents.completed).toExtend<AnyEventDef>();
  });
});
