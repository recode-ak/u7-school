import { describe, expect, it } from 'bun:test';
import {
  type Caller,
  type CallerKind,
  subjectOf,
  systemCaller,
} from './caller';

type User = { id: string };

const alice: User = { id: 'alice' };
const bob: User = { id: 'bob' };

describe('subjectOf', () => {
  it('user — он сам', () => {
    const caller: Caller<User> = { kind: 'user', user: alice };
    expect(subjectOf(caller)).toBe(alice);
  });

  it('delegate — замещаемый, а не заместитель', () => {
    const caller: Caller<User> = {
      kind: 'delegate',
      subject: alice,
      actor: bob,
      delegationId: 'd1',
    };
    expect(subjectOf(caller)).toBe(alice);
  });

  it('guest и system — без субъекта', () => {
    const guest: Caller<User> = { kind: 'guest', channelId: 'tg:1' };
    expect(subjectOf(guest)).toBeUndefined();
    expect(
      subjectOf(systemCaller<User>('todo.todo.completed')),
    ).toBeUndefined();
  });
});

describe('systemCaller', () => {
  it('несёт источник и исходного вызывающего', () => {
    const origin: Caller<User> = { kind: 'user', user: alice };
    const caller = systemCaller('todo.todo.completed', origin);
    expect(caller).toEqual({
      kind: 'system',
      source: 'todo.todo.completed',
      onBehalfOf: origin,
    });
  });
});

describe('CallerKind', () => {
  it('четыре подтипа', () => {
    const kinds: CallerKind[] = ['guest', 'user', 'delegate', 'system'];
    // @ts-expect-error неизвестный подтип
    const bad: CallerKind = 'admin';
    expect(kinds).toHaveLength(4);
  });
});
