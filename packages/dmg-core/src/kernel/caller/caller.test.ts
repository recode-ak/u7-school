import { describe, expect, it } from 'bun:test';
import {
  type Caller,
  type CallerKind,
  DelegateCaller,
  GuestCaller,
  type OperationRef,
  type PersonCaller,
  SystemCaller,
  UserCaller,
} from './caller';

type User = { readonly uuid: string };

const alice: User = { uuid: 'alice' };
const bob: User = { uuid: 'bob' };

const ucRef: OperationRef = {
  kind: 'useCase',
  module: 'wish',
  name: 'createCourseWish',
};
const erRef: OperationRef = {
  kind: 'eventReaction',
  module: 'todo',
  name: 'archiveRemovedUserTasks',
};

describe('GuestCaller', () => {
  const guest = new GuestCaller<User>();

  it('без субъекта, исходный человек — он сам', () => {
    expect(guest.kind).toBe('guest');
    expect(guest.subject()).toBeUndefined();
    expect(guest.person()).toBe(guest);
  });

  it('toLog — только вид', () => {
    expect(guest.toLog()).toEqual({ kind: 'guest' });
  });
});

describe('UserCaller', () => {
  const user = new UserCaller(alice);

  it('субъект и исходный человек — он сам', () => {
    expect(user.kind).toBe('user');
    expect(user.subject()).toBe(alice);
    expect(user.person()).toBe(user);
  });

  it('toLog — uuid субъекта', () => {
    expect(user.toLog()).toEqual({ kind: 'user', subjectId: 'alice' });
  });
});

describe('DelegateCaller', () => {
  const delegate = new DelegateCaller(alice, bob, 'd1');

  it('субъект — замещаемый, а не заместитель', () => {
    expect(delegate.kind).toBe('delegate');
    expect(delegate.subject()).toBe(alice);
    expect(delegate.actor).toBe(bob);
    expect(delegate.delegationId).toBe('d1');
    expect(delegate.person()).toBe(delegate);
  });

  it('toLog — субъект, заместитель и делегирование', () => {
    expect(delegate.toLog()).toEqual({
      kind: 'delegate',
      subjectId: 'alice',
      actorId: 'bob',
      delegationId: 'd1',
    });
  });
});

describe('SystemCaller', () => {
  it('без человека (ER, Job) — без субъекта', () => {
    const system = new SystemCaller<User>(erRef);
    expect(system.kind).toBe('system');
    expect(system.from).toEqual(erRef);
    expect(system.subject()).toBeUndefined();
    expect(system.person()).toBeUndefined();
    expect(system.toLog()).toEqual({ kind: 'system', from: erRef });
  });

  it('с человеком — его субъект, в том числе замещаемый', () => {
    const user = new UserCaller(alice);
    const delegate = new DelegateCaller(alice, bob, 'd1');
    expect(new SystemCaller(ucRef, user).subject()).toBe(alice);
    expect(new SystemCaller(ucRef, user).person()).toBe(user);
    expect(new SystemCaller(ucRef, delegate).subject()).toBe(alice);
    expect(new SystemCaller<User>(ucRef, new GuestCaller()).subject()).toBe(
      undefined,
    );
  });

  it('вложенный вызов передаёт исходного человека — матрёшки нет', () => {
    const user = new UserCaller(alice);
    const outer = new SystemCaller(ucRef, user);
    const inner = new SystemCaller(erRef, outer.person());
    expect(inner.person()).toBe(user);
    expect(inner.subject()).toBe(alice);
  });

  it('человек по типу — не SystemCaller', () => {
    // @ts-expect-error системный вызывающий не бывает исходным человеком
    const _person: PersonCaller<User> = new SystemCaller<User>(erRef);
    expect(_person).toBeInstanceOf(SystemCaller);
  });

  it('toLog — операция и запись человека', () => {
    const caller = new SystemCaller(ucRef, new UserCaller(alice));
    expect(caller.toLog()).toEqual({
      kind: 'system',
      from: ucRef,
      person: { kind: 'user', subjectId: 'alice' },
    });
  });
});

describe('Caller', () => {
  it('общий тип принимает все виды', () => {
    const callers: Caller<User>[] = [
      new GuestCaller(),
      new UserCaller(alice),
      new DelegateCaller(alice, bob, 'd1'),
      new SystemCaller(erRef),
    ];
    expect(callers.map((c) => c.kind)).toEqual([
      'guest',
      'user',
      'delegate',
      'system',
    ]);
  });

  it('CallerKind — четыре вида, module нет', () => {
    const kinds: CallerKind[] = ['guest', 'user', 'delegate', 'system'];
    // @ts-expect-error вызывающего module больше нет (D-43)
    const _module: CallerKind = 'module';
    expect(kinds).toHaveLength(4);
  });
});
