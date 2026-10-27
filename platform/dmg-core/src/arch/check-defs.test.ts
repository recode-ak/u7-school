import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  defineAggregate,
  type StateSchema,
} from '../domain/aggregate/define-aggregate';
import { defineEventReaction } from '../domain/contracts/define-event-reaction';
import { defineJob } from '../domain/contracts/define-job';
import {
  type AnyModuleDef,
  defineModule,
} from '../domain/contracts/define-module';
import {
  type AnyUseCaseDef,
  defineUseCase,
} from '../domain/contracts/define-use-case';
import { type AnyEventDef, defineEvents } from '../domain/events/define-events';
import { allowAll } from '../domain/policy/policy';
import { domainRule } from '../domain/rules/domain-rule';
import { DefIndex } from '../graph/def-index';
import { defineErrors } from '../kernel/errors/define-errors';
import { BaseEntityFields, F } from '../kernel/fields/fields';
import { ok } from '../kernel/result/result';
import {
  AddNoteErDef,
  AlphaModuleDef,
  BetaModuleDef,
  CreateItemUcDef,
  GetItemUcDef,
  ItemArDef,
  ItemErrors,
  ItemEvents,
  NoteArDef,
  NoteEvents,
  PurgeNotesJobDef,
} from './arch.fixture';
import { checkDefs } from './check-defs';

const report = (...roots: AnyModuleDef[]): string[] =>
  checkDefs(DefIndex.from(roots)).map((v) => v.format());

const ThingEvents = defineEvents('gamma.thing', {
  happened: {
    label: 'Случилось',
    description: 'Что-то случилось.',
    payload: v.object({ thingId: F.uuid('вещи') }),
  },
});

/** Модуль `gamma` с одним агрегатом и UC, который публикует его событие. */
function gamma(
  over: {
    label?: string;
    state?: StateSchema;
    input?: v.GenericSchema;
    events?: { readonly [key: string]: AnyEventDef };
    errors?: Parameters<typeof defineErrors>[1];
    errorPrefix?: string;
  } = {},
): AnyModuleDef {
  const events = over.events ?? ThingEvents;
  const ThingArDef = defineAggregate({
    name: 'thing',
    label: 'Вещь',
    description: 'Вещь для негативных фикстур.',
    state: v.object({ ...BaseEntityFields }),
    ...(over.state ? { state: over.state } : {}),
    events,
    errors: defineErrors(over.errorPrefix ?? 'THING', over.errors ?? {}),
  });
  const DoItUcDef = defineUseCase({
    name: 'doIt',
    label: 'Сделать',
    description: 'Делает дело.',
    type: 'command',
    aggregate: ThingArDef,
    callers: ['user'],
    policy: allowAll,
    input: over.input ?? v.object({}),
    output: v.object({}),
    errors: [],
    emits: Object.values(events),
  });
  return defineModule({
    name: 'gamma',
    label: over.label ?? 'Гамма',
    description: 'Модуль негативных фикстур.',
    dependsOn: [],
    aggregates: [ThingArDef],
    useCases: [DoItUcDef],
    reactions: [],
    jobs: [],
  });
}

describe('checkDefs', () => {
  it('чистые модули — без нарушений', () => {
    expect(report(AlphaModuleDef)).toEqual([]);
    expect(report(gamma())).toEqual([]);
  });

  describe('MAN-01 — описания Def', () => {
    it('пустой label модуля', () => {
      expect(report(gamma({ label: ' ' }))).toEqual([
        'MAN-01: модуль gamma: пустой label',
      ]);
    });

    it('пустой description события', () => {
      const events = defineEvents('gamma.thing', {
        happened: {
          label: 'Случилось',
          description: '',
          payload: v.object({}),
        },
      });
      expect(report(gamma({ events }))).toEqual([
        'MAN-01: событие gamma.thing.happened: пустой description',
      ]);
    });
  });

  describe('MAN-02 — описания полей схем', () => {
    it('поле без description, в том числе вложенное', () => {
      const state = v.object({
        ...BaseEntityFields,
        title: v.string(),
        meta: v.pipe(v.object({ tag: v.string() }), v.description('Мета')),
      });
      expect(report(gamma({ state }))).toEqual([
        'MAN-02: агрегат gamma.thing state: поле title без description',
        'MAN-02: агрегат gamma.thing state: поле meta.tag без description',
      ]);
    });

    it('поля элементов массива объектов', () => {
      const input = v.object({
        rows: v.pipe(
          v.array(v.object({ n: v.number() })),
          v.description('Строки'),
        ),
      });
      expect(report(gamma({ input }))).toEqual([
        'MAN-02: UC gamma.doIt input: поле rows[].n без description',
      ]);
    });
  });

  describe('MAN-03 — JSON Schema', () => {
    it('непереводимая схема — нарушение, MAN-02 для неё молчит', () => {
      const input = v.object({ x: v.custom<string>(() => true) });
      const [first, ...rest] = report(gamma({ input }));
      expect(first).toStartWith(
        'MAN-03: UC gamma.doIt input: не переводится в JSON Schema — ',
      );
      expect(rest).toEqual([]);
    });
  });

  describe('MAN-06 — связность', () => {
    it('неопубликованное событие и висячий подписчик', () => {
      const beta = defineModule({ ...BetaModuleDef, useCases: [] });
      const alpha = defineModule({ ...AlphaModuleDef, dependsOn: [beta] });
      expect(report(alpha)).toEqual([
        'MAN-06: ER alpha.addNote: UC getItem не входит ни в один модуль',
        'MAN-06: ER alpha.addNote слушает beta.item.created, которое никто не публикует',
        'MAN-06: событие beta.item.created никто не публикует',
      ]);
    });

    it('операция трогает агрегат и публикует событие чужого модуля', () => {
      const er = defineEventReaction({
        ...AddNoteErDef,
        touches: [ItemArDef],
        emits: [ItemEvents.created],
      });
      const alpha = defineModule({
        ...AlphaModuleDef,
        reactions: [er],
      });
      expect(report(alpha)).toEqual([
        'MAN-06: ER alpha.addNote: публикует событие beta.item.created другого модуля',
        'MAN-06: событие alpha.note.added никто не публикует',
        'MAN-13: ER alpha.addNote: агрегат beta.item модуля beta',
      ]);
    });

    it('Def вне модулей: агрегат UC, событие и ошибка', () => {
      const LostErrors = defineErrors('LOST', {
        GONE: { kind: 'not_found', label: 'Нет', description: 'Пропало.' },
      });
      const uc = defineUseCase({
        ...CreateItemUcDef,
        aggregate: NoteArDef,
        errors: [LostErrors.GONE],
      });
      const beta = defineModule({ ...BetaModuleDef, useCases: [uc] });
      expect(report(beta)).toEqual([
        'MAN-06: UC beta.createItem: агрегат note не входит ни в один модуль',
        'MAN-06: UC beta.createItem: ошибка LOST_GONE не входит ни в один модуль',
      ]);
    });

    it('подписка на событие вне модулей', () => {
      const er = defineEventReaction({
        ...AddNoteErDef,
        on: [NoteEvents.added],
        emits: [],
        calls: [],
      });
      const beta = defineModule({
        ...BetaModuleDef,
        aggregates: [ItemArDef],
        reactions: [er],
      });
      expect(report(beta)).toContain(
        'MAN-06: ER beta.addNote: событие alpha.note.added не входит ни в один модуль',
      );
    });
  });

  describe('MAN-13 — один UoW — один модуль (D-28)', () => {
    const man13 = (...roots: AnyModuleDef[]): string[] =>
      report(...roots).filter((l) => l.startsWith('MAN-13'));

    it('UC, ER и Job с агрегатом чужого модуля — нарушение', () => {
      const uc = defineUseCase({
        ...CreateItemUcDef,
        name: 'createNote',
        aggregate: ItemArDef,
      });
      const er = defineEventReaction({
        ...AddNoteErDef,
        touches: [NoteArDef, ItemArDef],
      });
      const job = defineJob({ ...PurgeNotesJobDef, scans: [ItemArDef] });
      const alpha = defineModule({
        ...AlphaModuleDef,
        useCases: [uc],
        reactions: [er],
        jobs: [job],
      });
      expect(man13(alpha)).toEqual([
        'MAN-13: UC alpha.createNote: агрегат beta.item модуля beta',
        'MAN-13: ER alpha.addNote: агрегат beta.item модуля beta',
        'MAN-13: Job alpha.purgeNotes: агрегат beta.item модуля beta',
      ]);
    });

    it('агрегаты своего модуля — без нарушений', () => {
      expect(man13(AlphaModuleDef)).toEqual([]);
    });
  });

  describe('MAN-08 — FQN событий', () => {
    it('префикс не совпадает с модулем и агрегатом', () => {
      const events = defineEvents('gamma.other', {
        happened: {
          label: 'Случилось',
          description: 'Что-то случилось.',
          payload: v.object({}),
        },
      });
      expect(report(gamma({ events }))).toEqual([
        'MAN-08: событие gamma.other.happened агрегата gamma.thing: ожидается префикс gamma.thing.',
      ]);
    });
  });

  describe('ARC-04 — ссылки Def ⊆ dependsOn', () => {
    it('событие и UC из calls модуля вне dependsOn', () => {
      const alpha = defineModule({ ...AlphaModuleDef, dependsOn: [] });
      expect(report(alpha, BetaModuleDef)).toEqual([
        'ARC-04: ER alpha.addNote: событие beta.item.created модуля beta, которого нет в dependsOn alpha',
        'ARC-04: ER alpha.addNote: UC beta.getItem модуля beta, которого нет в dependsOn alpha',
      ]);
    });

    it('calls UC и Job — тоже ⊆ dependsOn', () => {
      const ShowUcDef = defineUseCase({
        name: 'showNote',
        label: 'Показать заметку',
        description: 'Заметка с позицией каталога.',
        type: 'query',
        aggregate: NoteArDef,
        callers: ['user'],
        policy: allowAll,
        calls: [GetItemUcDef],
        input: v.object({}),
        output: v.object({}),
        errors: [],
      });
      const alpha = defineModule({
        ...AlphaModuleDef,
        dependsOn: [],
        useCases: [ShowUcDef],
        reactions: [],
        jobs: [defineJob({ ...PurgeNotesJobDef, calls: [GetItemUcDef] })],
      });
      const arc04 = report(alpha, BetaModuleDef).filter((l) =>
        l.startsWith('ARC-04'),
      );
      expect(arc04).toEqual([
        'ARC-04: UC alpha.showNote: UC beta.getItem модуля beta, которого нет в dependsOn alpha',
        'ARC-04: Job alpha.purgeNotes: UC beta.getItem модуля beta, которого нет в dependsOn alpha',
      ]);
    });
  });

  describe('MAN-05 — calls (D-42)', () => {
    const withCalls = (calls: AnyUseCaseDef[], extra: AnyUseCaseDef[] = []) =>
      defineModule({
        ...AlphaModuleDef,
        useCases: extra,
        reactions: [defineEventReaction({ ...AddNoteErDef, calls })],
      });

    it('UC своего модуля в calls — нарушение', () => {
      const OwnUcDef = defineUseCase({
        ...GetItemUcDef,
        name: 'getNote',
        aggregate: NoteArDef,
        errors: [],
      });
      expect(report(withCalls([OwnUcDef], [OwnUcDef]))).toEqual([
        'MAN-05: ER alpha.addNote: UC alpha.getNote своего модуля — calls только для UC других модулей',
      ]);
    });

    it('вызываемый UC не допускает system в callers — нарушение', () => {
      expect(report(withCalls([CreateItemUcDef]))).toEqual([
        'MAN-05: ER alpha.addNote: UC beta.createItem не объявляет system в callers',
      ]);
    });

    it('UC вне модулей в calls — MAN-06', () => {
      const LostUcDef = defineUseCase({ ...GetItemUcDef, name: 'lost' });
      expect(report(withCalls([LostUcDef]))).toEqual([
        'MAN-06: ER alpha.addNote: UC lost не входит ни в один модуль',
      ]);
    });
  });

  describe('ARC-05 — dependsOn без циклов', () => {
    it('цикл назван путём', () => {
      const deps: AnyModuleDef[] = [];
      const a = defineModule({ ...gamma(), name: 'a', dependsOn: deps });
      const b = defineModule({ ...gamma(), name: 'b', dependsOn: [a] });
      deps.push(b);
      expect(report(a).filter((m) => m.startsWith('ARC-05'))).toEqual([
        'ARC-05: цикл dependsOn: a → b → a',
      ]);
    });
  });

  describe('ERR-04 — коды ошибок', () => {
    it('один код у разных Def', () => {
      const Twin = defineErrors('ITEM', {
        NOT_FOUND: { kind: 'not_found', label: 'Нет', description: 'Нет.' },
      });
      const twinAr = defineAggregate({
        ...ItemArDef,
        name: 'twin',
        errors: Twin,
      });
      const beta = defineModule({
        ...BetaModuleDef,
        aggregates: [ItemArDef, twinAr],
      });
      expect(report(beta)).toContain(
        'ERR-04: код ITEM_NOT_FOUND объявлен в 2 разных Def',
      );
    });

    it('совпадение с базовой ошибкой ядра', () => {
      const m = gamma({
        errorPrefix: '',
        errors: {
          UNAUTHORIZED: {
            kind: 'unauthorized',
            label: 'Нельзя',
            description: 'Нельзя.',
          },
        },
      });
      expect(report(m)).toEqual([
        'ERR-04: ошибка UNAUTHORIZED агрегата gamma.thing: ожидается префикс THING_',
        'ERR-04: код UNAUTHORIZED объявлен в 2 разных Def',
      ]);
    });

    it('префикс не совпадает с агрегатом', () => {
      const m = gamma({
        errorPrefix: 'THINGS',
        errors: {
          LOST: { kind: 'not_found', label: 'Нет', description: 'Нет.' },
        },
      });
      expect(report(m)).toEqual([
        'ERR-04: ошибка THINGS_LOST агрегата gamma.thing: ожидается префикс THING_',
      ]);
    });
  });

  describe('MAN-12 — отказы переходов из группы ошибок агрегата', () => {
    it('ошибка отказа чужой группы', () => {
      const Foreign = defineErrors('OTHER', {
        CLOSED: { kind: 'conflict', label: 'Закрыта', description: 'Чужая.' },
      });
      const Own = defineErrors('DOOR', {
        OPEN: { kind: 'conflict', label: 'Открыта', description: 'Своя.' },
      });
      const DoorEvents = defineEvents('delta.door', {});
      const DoorArDef = defineAggregate({
        name: 'door',
        label: 'Дверь',
        description: 'Дверь для фикстуры переходов.',
        state: v.object({
          ...BaseEntityFields,
          status: F.picklist(['open', 'closed'], 'Положение'),
        }),
        statuses: { open: { label: 'Открыта' }, closed: { label: 'Закрыта' } },
        transitions: {
          close: {
            from: ['open'],
            to: 'closed',
            rejects: { closed: Foreign.CLOSED },
          },
          open: { from: ['closed'], to: 'open', rejects: { open: Own.OPEN } },
        },
        events: DoorEvents,
        errors: Own,
      });
      const m = defineModule({
        name: 'delta',
        label: 'Дельта',
        description: 'Модуль фикстуры переходов.',
        dependsOn: [],
        aggregates: [DoorArDef],
        useCases: [],
        reactions: [],
        jobs: [],
      });
      expect(report(m).filter((l) => l.startsWith('MAN-12'))).toEqual([
        'MAN-12: агрегат delta.door, переход close: отказ OTHER_CLOSED не из ошибок агрегата',
      ]);
    });
  });

  describe('MAN-06 — внешний модуль (только контракт)', () => {
    const OuterEvents = defineEvents('outer.item', {
      appeared: {
        label: 'Появилась',
        description: 'Запись появилась во внешней системе.',
        payload: v.object({ itemId: F.uuid('записи') }),
      },
    });
    const OuterItemArDef = defineAggregate({
      name: 'item',
      label: 'Запись',
      description: 'Запись внешнего модуля.',
      state: v.object({ ...BaseEntityFields }),
      events: OuterEvents,
      errors: defineErrors('ITEM', {}),
    });
    const outer = (over: Partial<AnyModuleDef> = {}) =>
      defineModule({
        name: 'outer',
        label: 'Внешний',
        description: 'Модуль вне приложения: известен только контракт.',
        external: true,
        dependsOn: [],
        aggregates: [OuterItemArDef],
        useCases: [],
        reactions: [],
        jobs: [],
        ...over,
      });

    it('события внешнего модуля публикует внешняя сторона — подписка допустима', () => {
      const Outer = outer();
      const WatchErDef = defineEventReaction({
        name: 'watchOuter',
        label: 'Следить',
        description: 'Реагирует на внешнее событие.',
        on: [OuterEvents.appeared],
        touches: [],
        calls: [],
        emits: [],
      });
      const inner = defineModule({
        name: 'inner',
        label: 'Внутренний',
        description: 'Слушает внешний модуль.',
        dependsOn: [Outer],
        aggregates: [],
        useCases: [],
        reactions: [WatchErDef],
        jobs: [],
      });
      expect(report(inner).filter((l) => l.startsWith('MAN-06'))).toEqual([]);
    });

    const OuterGetUcDef = defineUseCase({
      name: 'getOuterItem',
      label: 'Внешняя запись',
      description: 'Запись внешнего модуля — Def без реализации.',
      type: 'query',
      aggregate: OuterItemArDef,
      callers: ['system'],
      policy: allowAll,
      input: v.object({ itemId: F.uuid('записи') }),
      output: v.object({}),
      errors: [],
    });

    it('Def UC без реализации — контракт, на него ссылаются calls (D-42)', () => {
      const Outer = outer({ useCases: [OuterGetUcDef] });
      const WatchErDef = defineEventReaction({
        name: 'watchOuter',
        label: 'Следить',
        description: 'Читает внешнюю запись через фасад.',
        on: [OuterEvents.appeared],
        calls: [OuterGetUcDef],
      });
      const inner = defineModule({
        name: 'inner',
        label: 'Внутренний',
        description: 'Вызывает UC внешнего модуля.',
        dependsOn: [Outer],
        aggregates: [],
        useCases: [],
        reactions: [WatchErDef],
        jobs: [],
      });
      expect(report(inner)).toEqual([]);
    });

    it('у внешнего модуля нет ER и Job', () => {
      const m = outer({ jobs: [PurgeNotesJobDef] });
      expect(report(m)).toContain(
        'MAN-06: модуль outer внешний — ER и Job у него не объявляются',
      );
    });
  });

  describe('доменные правила UC', () => {
    const itemExists = (label = 'Позиция есть') =>
      domainRule({
        name: 'itemExists',
        label,
        description: 'Действие допустимо только над существующей позицией.',
        error: ItemErrors.NOT_FOUND,
        check: (_: unknown) => ok(),
      });
    const withRules = (
      rules: readonly ReturnType<typeof itemExists>[],
      errors = [ItemErrors.NOT_FOUND],
    ) =>
      defineModule({
        ...BetaModuleDef,
        useCases: [defineUseCase({ ...CreateItemUcDef, errors, rules })],
      });

    it('объявленная ошибка правила — без нарушений', () => {
      expect(report(withRules([itemExists()]))).toEqual([]);
    });

    it('ERR-02: ошибка правила не объявлена в errors UC', () => {
      expect(report(withRules([itemExists()], []))).toEqual([
        'ERR-02: UC beta.createItem: ошибка ITEM_NOT_FOUND правила itemExists не объявлена в errors',
      ]);
    });

    it('DOM-16: одно правило дважды в rules UC', () => {
      const rule = itemExists();
      expect(report(withRules([rule, rule]))).toEqual([
        'DOM-16: UC beta.createItem: правило itemExists указано в rules дважды',
      ]);
    });

    it('MAN-01: пустой label правила', () => {
      expect(report(withRules([itemExists(' ')]))).toEqual([
        'MAN-01: правило beta.item.itemExists: пустой label',
      ]);
    });

    it('MAN-01: правило чужого модуля — заголовок по владельцу ошибки', () => {
      const m = defineModule({
        ...AlphaModuleDef,
        useCases: [
          defineUseCase({
            ...CreateItemUcDef,
            name: 'noteItem',
            aggregate: NoteArDef,
            emits: [],
            errors: [ItemErrors.NOT_FOUND],
            rules: [itemExists(' ')],
          }),
        ],
      });
      expect(report(m).filter((l) => l.startsWith('MAN-01'))).toEqual([
        'MAN-01: правило beta.item.itemExists: пустой label',
      ]);
    });
  });
});
