import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { type AnyEventDef, EventDef, type EventOf } from './event-def';

const TaskEvents = EventDef.define('todo.task', {
  created: {
    label: 'Задача создана',
    description: 'В списке появилась новая задача.',
    payload: v.object({ taskId: v.string(), title: v.string() }),
  },
  completed: {
    label: 'Задача выполнена',
    description: 'Задача отмечена выполненной.',
    payload: v.object({ taskId: v.string() }),
  },
});

describe('EventDef.define', () => {
  it('FQN = префикс группы `module.aggregate` + ключ', () => {
    expect(TaskEvents.created.name).toBe('todo.task.created');
    expect(TaskEvents.completed.name).toBe('todo.task.completed');
  });

  it('Def несёт дискриминатор, label, description и схему payload', () => {
    const def = TaskEvents.created;
    expect(def.dmg).toBe('event');
    expect(def.label).toBe('Задача создана');
    expect(def.description).toBe('В списке появилась новая задача.');
    expect(v.is(def.payload, { taskId: 't1', title: 'Купить' })).toBe(true);
  });

  it('make() даёт событие с FQN и payload', () => {
    const event = TaskEvents.completed.make({ taskId: 't1' });
    expect(event).toEqual({
      name: 'todo.task.completed',
      payload: { taskId: 't1' },
    });
  });

  it('тип события выводится из Def', () => {
    const event: EventOf<typeof TaskEvents.created> = TaskEvents.created.make({
      taskId: 't1',
      title: 'Купить',
    });
    const name: 'todo.task.created' = event.name;
    const title: string = event.payload.title;
    expect([name, title]).toEqual(['todo.task.created', 'Купить']);
    // @ts-expect-error payload проверяется схемой Def
    TaskEvents.completed.make({ id: 't1' });
  });

  it('EventOf от union Def — размеченный union событий', () => {
    type Either = EventOf<
      typeof TaskEvents.created | typeof TaskEvents.completed
    >;
    const handle = (e: Either): string =>
      e.name === 'todo.task.created' ? e.payload.title : e.payload.taskId;
    expect(handle(TaskEvents.completed.make({ taskId: 't1' }))).toBe('t1');
  });

  it('ссылка на событие — сам объект Def', () => {
    const on: readonly AnyEventDef[] = [TaskEvents.created];
    expect(on[0]).toBe(TaskEvents.created);
  });

  it('префикс обязан иметь вид `module.aggregate`', () => {
    // @ts-expect-error префикс без агрегата
    EventDef.define('todo', {});
    expect(true).toBe(true);
  });
});
