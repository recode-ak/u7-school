import { describe, expect, it } from 'bun:test';
import {
  Caller,
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

/** Граница процесса: JSON туда и обратно, как в транспорте. */
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('Caller.toJSON / fromJSON — круг через JSON (D-46)', () => {
  const cases: readonly {
    readonly name: string;
    readonly caller: Caller<User>;
    readonly type: abstract new (...args: never[]) => Caller<User>;
  }[] = [
    { name: 'guest', caller: new GuestCaller(), type: GuestCaller },
    { name: 'user', caller: new UserCaller(alice), type: UserCaller },
    {
      name: 'delegate',
      caller: new DelegateCaller(alice, bob, 'd1'),
      type: DelegateCaller,
    },
    { name: 'system', caller: new SystemCaller(erRef), type: SystemCaller },
    {
      name: 'system + guest',
      caller: new SystemCaller<User>(ucRef, new GuestCaller()),
      type: SystemCaller,
    },
    {
      name: 'system + user',
      caller: new SystemCaller(ucRef, new UserCaller(alice)),
      type: SystemCaller,
    },
    {
      name: 'system + delegate',
      caller: new SystemCaller(ucRef, new DelegateCaller(alice, bob, 'd1')),
      type: SystemCaller,
    },
  ];

  for (const { name, caller, type } of cases) {
    it(`${name}: тот же класс, субъект, человек, toLog и toJSON`, () => {
      const restored = Caller.fromJSON<User>(wire(caller.toJSON()));
      expect(restored).toBeInstanceOf(type);
      expect(restored.kind).toBe(caller.kind);
      expect(restored.subject()).toEqual(caller.subject());
      expect(restored.person()?.constructor).toBe(caller.person()?.constructor);
      expect(restored.person()?.toLog()).toEqual(caller.person()?.toLog());
      expect(restored.toLog()).toEqual(caller.toLog());
      expect(restored.toJSON()).toEqual(caller.toJSON());
    });
  }

  it('toJSON — субъект целиком, без undefined-полей', () => {
    const rich = { uuid: 'alice', name: 'Алиса' };
    expect(new GuestCaller().toJSON()).toStrictEqual({ kind: 'guest' });
    expect(new UserCaller(rich).toJSON()).toStrictEqual({
      kind: 'user',
      user: rich,
    });
    expect(new DelegateCaller(alice, bob, 'd1').toJSON()).toStrictEqual({
      kind: 'delegate',
      principal: alice,
      actor: bob,
      delegationId: 'd1',
    });
    expect(new SystemCaller(erRef).toJSON()).toStrictEqual({
      kind: 'system',
      from: erRef,
    });
    expect(
      new SystemCaller(ucRef, new UserCaller(alice)).toJSON(),
    ).toStrictEqual({
      kind: 'system',
      from: ucRef,
      person: { kind: 'user', user: alice },
    });
  });

  it('system.person восстанавливается человеком, а не SystemCaller', () => {
    const json = new SystemCaller(ucRef, new UserCaller(alice)).toJSON();
    const restored = Caller.fromJSON<User>(wire(json));
    expect(restored.person()).toBeInstanceOf(UserCaller);
    expect(restored.subject()).toEqual(alice);
  });

  it('revive вызывается для каждого субъекта', () => {
    class Person {
      constructor(readonly uuid: string) {}
    }
    const seen: unknown[] = [];
    const revive = (raw: unknown): Person => {
      seen.push(raw);
      return new Person((raw as User).uuid);
    };
    const caller = new SystemCaller(
      ucRef,
      new DelegateCaller(alice, bob, 'd1'),
    );
    const restored = Caller.fromJSON(wire(caller.toJSON()), revive);
    expect(seen).toEqual([alice, bob]);
    expect(restored.subject()).toBeInstanceOf(Person);
    const delegate = restored.person();
    if (!(delegate instanceof DelegateCaller)) throw new Error('не delegate');
    expect(delegate.actor).toBeInstanceOf(Person);

    seen.length = 0;
    Caller.fromJSON(wire(new UserCaller(alice).toJSON()), revive);
    expect(seen).toEqual([alice]);
  });

  it('без revive субъект — как есть', () => {
    const rich = { uuid: 'alice', name: 'Алиса' };
    const restored = Caller.fromJSON(wire(new UserCaller(rich).toJSON()));
    expect(restored.subject()).toEqual(rich);
  });

  it('system внутри system — ошибка (матрёшки нет)', () => {
    const nested = {
      kind: 'system',
      from: ucRef,
      person: { kind: 'system', from: erRef },
    };
    expect(() => Caller.fromJSON(nested)).toThrow(/Caller\.fromJSON/);
  });

  it('невалидный JSON — Error с понятным текстом', () => {
    for (const bad of [
      null,
      'user',
      {},
      { kind: 'module' },
      { kind: 'user' },
      { kind: 'user', user: { name: 'без uuid' } },
      { kind: 'delegate', principal: alice, actor: bob },
      { kind: 'system', from: { kind: 'useCase', module: 'wish' } },
    ]) {
      expect(() => Caller.fromJSON(bad)).toThrow(/Caller\.fromJSON/);
    }
  });
});
