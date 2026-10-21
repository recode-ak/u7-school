import { describe, expect, it } from 'bun:test';
import {
  type Caller,
  type CallerKind,
  type CallingOperation,
  moduleCaller,
  originOf,
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
    const guest: Caller<User> = {
      kind: 'guest',
      channel: 'telegram',
      channelId: '1',
    };
    expect(subjectOf(guest)).toBeUndefined();
    expect(
      subjectOf(systemCaller<User>('todo.todo.completed')),
    ).toBeUndefined();
  });
});

describe('module', () => {
  const from: CallingOperation = { dmg: 'useCase', name: 'notify', calls: [] };
  const user: Caller<User> = { kind: 'user', user: alice };
  const delegate: Caller<User> = {
    kind: 'delegate',
    subject: alice,
    actor: bob,
    delegationId: 'd1',
  };

  it('moduleCaller несёт вызвавшую операцию и исходного вызывающего', () => {
    expect(moduleCaller(from, user)).toEqual({
      kind: 'module',
      from,
      origin: user,
    });
  });

  it('субъект — субъект origin, в том числе через цепочку модулей', () => {
    expect(subjectOf(moduleCaller(from, user))).toBe(alice);
    expect(subjectOf(moduleCaller(from, delegate))).toBe(alice);
    expect(subjectOf(moduleCaller(from, moduleCaller(from, user)))).toBe(alice);
    expect(
      subjectOf(moduleCaller(from, systemCaller<User>('job'))),
    ).toBeUndefined();
  });

  it('originOf — исходный вызывающий цепочки модулей', () => {
    expect(originOf(user)).toBe(user);
    expect(originOf(moduleCaller(from, moduleCaller(from, delegate)))).toBe(
      delegate,
    );
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

describe('GuestCaller', () => {
  it('канал и идентификатор в нём необязательны', () => {
    const anonymous: Caller<User> = { kind: 'guest' };
    expect(subjectOf(anonymous)).toBeUndefined();
  });
});

describe('CallerKind', () => {
  it('пять подтипов', () => {
    const kinds: CallerKind[] = [
      'guest',
      'user',
      'delegate',
      'module',
      'system',
    ];
    // @ts-expect-error неизвестный подтип
    const bad: CallerKind = 'admin';
    expect(kinds).toHaveLength(5);
  });
});
