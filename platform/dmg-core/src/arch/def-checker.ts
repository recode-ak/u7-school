import type { JsonSchema } from '@valibot/to-json-schema';
import type * as v from 'valibot';
import type { AnyModuleDef } from '../domain/contracts/module-def';
import type { AnyEventDef } from '../domain/events/event-def';
import type { AnyDomainRule } from '../domain/rules/domain-rule-def';
import type { DefIndex } from '../graph/def-index';
import { CoreErrors } from '../kernel/errors/core-errors';
import type { AnyErrorDef } from '../kernel/errors/error-def';
import { toJsonSchema } from '../kernel/schema/json-schema';
import { TODO_TEXT } from './todo-text';
import { Violation } from './violation';

/** Def с описаниями и схемами — в виде, общем для MAN-01/02/03. */
type DescribedDef = {
  /** Вид и id для сообщения: `UC alpha.addNote`. */
  readonly title: string;
  readonly label: string;
  readonly description: string;
  readonly schemas: readonly (readonly [name: string, v.GenericSchema])[];
};

/**
 * Контрактные проверки по Def (без файлов): описания и схемы (MAN-01/02/03),
 * связность (MAN-06), FQN (MAN-08), ссылки ⊆ `dependsOn` (ARC-04), DAG
 * (ARC-05), коды ошибок (ERR-04), отказы переходов (MAN-12), доменные
 * правила UC (ERR-02, DOM-16), межмодульные вызовы `calls` (MAN-05),
 * агрегаты операции — своего модуля (MAN-13).
 */
export class DefChecker {
  constructor(private readonly index: DefIndex) {}

  check(): Violation[] {
    return [
      ...this.checkTexts(),
      ...this.checkSchemas(),
      ...this.checkLinks(),
      ...this.checkFqn(),
      ...this.checkDependsOn(),
      ...this.checkCycles(),
      ...this.checkErrorCodes(),
      ...this.checkRejects(),
      ...this.checkUseCaseRules(),
      ...this.checkCalls(),
      ...this.checkOwnAggregates(),
    ];
  }

  /**
   * Незаполненные тексты: `label`/`description` Def и метки статусов
   * агрегатов начинаются со слова `TODO` (так их оставляет `dmg-core gen`).
   * Не нарушения — предупреждения MAN-01: заготовка после `gen` проходит
   * `check` без правок, а `arch:check` печатает, что осталось заполнить.
   * Тексты Policy в граф Def не входят — их находит `FileChecker.todos`.
   */
  todos(): Violation[] {
    const out: Violation[] = [];
    const add = (title: string, field: string, text: string): void => {
      const trimmed = text.trim();
      if (!TODO_TEXT.test(trimmed)) return;
      out.push(
        new Violation(
          'MAN-01',
          `${title}: ${field} не заполнен — «${trimmed}»`,
        ),
      );
    };
    for (const d of this.described()) {
      add(d.title, 'label', d.label);
      add(d.title, 'description', d.description);
    }
    for (const m of this.index.modules) {
      for (const a of m.aggregates) {
        const statuses: Record<string, { readonly label: string }> =
          a.statuses ?? {};
        for (const [status, { label }] of Object.entries(statuses)) {
          add(`агрегат ${m.localId(a)} статус ${status}`, 'label', label);
        }
      }
    }
    return out;
  }

  private checkTexts(): Violation[] {
    const out: Violation[] = [];
    for (const d of this.described()) {
      if (d.label.trim() === '') {
        out.push(new Violation('MAN-01', `${d.title}: пустой label`));
      }
      if (d.description.trim() === '') {
        out.push(new Violation('MAN-01', `${d.title}: пустой description`));
      }
    }
    return out;
  }

  private checkSchemas(): Violation[] {
    const out: Violation[] = [];
    for (const d of this.described()) {
      for (const [name, schema] of d.schemas) {
        let json: JsonSchema;
        try {
          json = toJsonSchema(schema);
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          out.push(
            new Violation(
              'MAN-03',
              `${d.title} ${name}: не переводится в JSON Schema — ${reason}`,
            ),
          );
          continue;
        }
        for (const field of this.undocumented(json, '')) {
          out.push(
            new Violation(
              'MAN-02',
              `${d.title} ${name}: поле ${field} без description`,
            ),
          );
        }
      }
    }
    return out;
  }

  /** Пути полей без `description`: свойства объектов, элементы массивов, варианты. */
  private undocumented(s: JsonSchema | boolean, path: string): string[] {
    if (typeof s === 'boolean') return [];
    const out: string[] = [];
    for (const [key, prop] of Object.entries(s.properties ?? {})) {
      const field = path === '' ? key : `${path}.${key}`;
      if (typeof prop !== 'boolean' && prop.description === undefined) {
        out.push(field);
      }
      out.push(...this.undocumented(prop, field));
    }
    if (s.items !== undefined && !Array.isArray(s.items)) {
      out.push(...this.undocumented(s.items, `${path}[]`));
    }
    for (const variant of [...(s.anyOf ?? []), ...(s.oneOf ?? [])]) {
      out.push(...this.undocumented(variant, path));
    }
    return out;
  }

  private checkLinks(): Violation[] {
    const out: Violation[] = [];
    const add = (message: string): void => {
      out.push(new Violation('MAN-06', message));
    };
    const published = new Set<AnyEventDef>();
    for (const op of this.index.operations()) {
      for (const e of op.emits) published.add(e);
    }
    // События внешнего модуля публикует внешняя сторона (D-37); его UC —
    // контракт без реализации, цель `calls` других модулей (D-42).
    for (const m of this.index.modules.filter((m) => m.external)) {
      if (m.reactions.length > 0 || m.jobs.length > 0) {
        add(`модуль ${m.name} внешний — ER и Job у него не объявляются`);
      }
      for (const a of m.aggregates) {
        for (const e of Object.values(a.events)) published.add(e);
      }
    }
    const eventModule = (e: AnyEventDef): AnyModuleDef | undefined => {
      const a = this.index.aggregateOf(e);
      return a && this.index.moduleOf(a);
    };
    const checkErrors = (title: string, errors: readonly AnyErrorDef[]) => {
      for (const e of errors) {
        if (!this.index.aggregateOf(e) && !this.isCoreError(e)) {
          add(`${title}: ошибка ${e.code} не входит ни в один модуль`);
        }
      }
    };

    for (const m of this.index.modules) {
      for (const op of m.operations()) {
        const title = op.title(m);
        for (const a of op.aggregates()) {
          const owner = this.index.moduleOf(a);
          if (owner === undefined) {
            add(`${title}: агрегат ${a.name} не входит ни в один модуль`);
          }
        }
        for (const e of op.emits) {
          const owner = eventModule(e);
          if (owner === undefined) {
            add(`${title}: событие ${e.name} не входит ни в один модуль`);
          } else if (owner !== m) {
            add(`${title}: публикует событие ${e.name} другого модуля`);
          }
        }
        for (const uc of op.calls) {
          if (!this.index.moduleOf(uc)) {
            add(`${title}: UC ${uc.name} не входит ни в один модуль`);
          }
        }
        checkErrors(title, op.referencedErrors());
        for (const e of op.subscribedEvents()) {
          if (eventModule(e) === undefined) {
            add(`${title}: событие ${e.name} не входит ни в один модуль`);
          } else if (!published.has(e)) {
            add(`${title} слушает ${e.name}, которое никто не публикует`);
          }
        }
      }
    }

    for (const m of this.index.modules) {
      for (const a of m.aggregates) {
        for (const e of Object.values(a.events)) {
          if (!published.has(e)) add(`событие ${e.name} никто не публикует`);
        }
      }
    }
    return out;
  }

  private checkFqn(): Violation[] {
    const out: Violation[] = [];
    for (const m of this.index.modules) {
      for (const a of m.aggregates) {
        const prefix = `${m.name}.${a.name}.`;
        for (const e of Object.values(a.events)) {
          const rest = e.name.slice(prefix.length);
          if (!e.name.startsWith(prefix) || rest === '' || rest.includes('.')) {
            out.push(
              new Violation(
                'MAN-08',
                `событие ${e.name} агрегата ${m.localId(a)}: ожидается префикс ${prefix}`,
              ),
            );
          }
        }
      }
    }
    return out;
  }

  /** MAN-12: отказы переходов — ошибки из группы самого агрегата. */
  private checkRejects(): Violation[] {
    const out: Violation[] = [];
    for (const m of this.index.modules) {
      for (const a of m.aggregates) {
        const own = new Set(Object.values(a.errors));
        for (const [op, t] of Object.entries(a.transitions ?? {})) {
          for (const e of Object.values(t.rejects)) {
            if (e === undefined || own.has(e)) continue;
            out.push(
              new Violation(
                'MAN-12',
                `агрегат ${m.localId(a)}, переход ${op}: отказ ${e.code} не из ошибок агрегата`,
              ),
            );
          }
        }
      }
    }
    return out;
  }

  /**
   * Доменные правила UC: ошибка правила — в `errors` UC (ERR-02: отказ
   * правила — ответ UC, вызывающий должен знать его код); правило в `rules`
   * не повторяется (DOM-16: декларация без дублей).
   */
  private checkUseCaseRules(): Violation[] {
    const out: Violation[] = [];
    for (const m of this.index.modules) {
      for (const uc of m.useCases) {
        const title = `UC ${m.localId(uc)}`;
        const seen = new Set<AnyDomainRule>();
        for (const r of uc.rules) {
          if (seen.has(r)) {
            out.push(
              new Violation(
                'DOM-16',
                `${title}: правило ${r.name} указано в rules дважды`,
              ),
            );
            continue;
          }
          seen.add(r);
          if (!uc.errors.includes(r.error)) {
            out.push(
              new Violation(
                'ERR-02',
                `${title}: ошибка ${r.error.code} правила ${r.name} не объявлена в errors`,
              ),
            );
          }
        }
      }
    }
    return out;
  }

  /**
   * MAN-05 (D-42): `calls` — UC других модулей (свой модуль вызывает свой UC
   * напрямую, без фасада), и вызываемый UC допускает вызывающего `system` —
   * иначе вызов через фасад всегда получит `UNAUTHORIZED`. Принадлежность
   * `dependsOn` — ARC-04 (`checkDependsOn`), Def вне модулей — MAN-06.
   */
  private checkCalls(): Violation[] {
    const out: Violation[] = [];
    for (const m of this.index.modules) {
      for (const op of m.operations()) {
        const title = op.title(m);
        for (const uc of op.calls) {
          const owner = this.index.moduleOf(uc);
          if (owner === undefined) continue;
          const id = owner.localId(uc);
          if (owner === m) {
            out.push(
              new Violation(
                'MAN-05',
                `${title}: UC ${id} своего модуля — calls только для UC других модулей`,
              ),
            );
          } else if (!uc.callers.includes('system')) {
            out.push(
              new Violation(
                'MAN-05',
                `${title}: UC ${id} не объявляет system в callers`,
              ),
            );
          }
        }
      }
    }
    return out;
  }

  /**
   * MAN-13 (D-28): один UoW — один модуль. `aggregate` UC, `touches` ER и
   * `scans` Job — агрегаты своего модуля; чужой модуль меняется только через
   * его фасад или событие. Агрегат вне модулей — MAN-06.
   */
  private checkOwnAggregates(): Violation[] {
    const out: Violation[] = [];
    for (const m of this.index.modules) {
      for (const op of m.operations()) {
        for (const a of op.aggregates()) {
          const owner = this.index.moduleOf(a);
          if (owner === undefined || owner === m) continue;
          out.push(
            new Violation(
              'MAN-13',
              `${op.title(m)}: агрегат ${owner.localId(a)} модуля ${owner.name}`,
            ),
          );
        }
      }
    }
    return out;
  }

  private checkDependsOn(): Violation[] {
    const out: Violation[] = [];
    for (const m of this.index.modules) {
      const check = (title: string, what: string, owner?: AnyModuleDef) => {
        if (owner && owner !== m && !m.dependsOn.includes(owner)) {
          out.push(
            new Violation(
              'ARC-04',
              `${title}: ${what} модуля ${owner.name}, которого нет в dependsOn ${m.name}`,
            ),
          );
        }
      };
      const checkErrors = (title: string, errors: readonly AnyErrorDef[]) => {
        for (const e of errors) {
          const a = this.index.aggregateOf(e);
          check(title, `ошибка ${e.code}`, a && this.index.moduleOf(a));
        }
      };
      for (const op of m.operations()) {
        const title = op.title(m);
        checkErrors(title, op.referencedErrors());
        for (const e of op.subscribedEvents()) {
          const a = this.index.aggregateOf(e);
          check(title, `событие ${e.name}`, a && this.index.moduleOf(a));
        }
        for (const uc of op.calls) {
          const owner = this.index.moduleOf(uc);
          if (owner) check(title, `UC ${owner.localId(uc)}`, owner);
        }
      }
    }
    return out;
  }

  private checkCycles(): Violation[] {
    const out: Violation[] = [];
    const done = new Set<AnyModuleDef>();
    const stack: AnyModuleDef[] = [];
    const visit = (m: AnyModuleDef): void => {
      if (done.has(m)) return;
      const at = stack.indexOf(m);
      if (at >= 0) {
        const path = [...stack.slice(at), m].map((x) => x.name).join(' → ');
        out.push(new Violation('ARC-05', `цикл dependsOn: ${path}`));
        return;
      }
      stack.push(m);
      for (const dep of m.dependsOn) visit(dep);
      stack.pop();
      done.add(m);
    };
    for (const m of this.index.modules) visit(m);
    return out;
  }

  private checkErrorCodes(): Violation[] {
    const out: Violation[] = [];
    const byCode = new Map<string, Set<AnyErrorDef>>();
    const add = (e: AnyErrorDef): void => {
      const defs = byCode.get(e.code) ?? new Set();
      defs.add(e);
      byCode.set(e.code, defs);
    };
    for (const e of Object.values(CoreErrors)) add(e);
    for (const m of this.index.modules) {
      for (const a of m.aggregates) {
        const prefix = `${this.upperSnake(a.name)}_`;
        for (const e of Object.values(a.errors)) {
          if (!e.code.startsWith(prefix)) {
            out.push(
              new Violation(
                'ERR-04',
                `ошибка ${e.code} агрегата ${m.localId(a)}: ожидается префикс ${prefix}`,
              ),
            );
          }
          add(e);
        }
      }
      for (const uc of m.useCases) for (const e of uc.errors) add(e);
    }
    for (const [code, defs] of byCode) {
      if (defs.size > 1) {
        out.push(
          new Violation(
            'ERR-04',
            `код ${code} объявлен в ${defs.size} разных Def`,
          ),
        );
      }
    }
    return out;
  }

  private isCoreError(e: AnyErrorDef): boolean {
    return Object.values<AnyErrorDef>(CoreErrors).includes(e);
  }

  /** `studentProgress`, `student-progress` → `STUDENT_PROGRESS` (ERR-04). */
  private upperSnake(name: string): string {
    return name
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replaceAll('-', '_')
      .toUpperCase();
  }

  /**
   * Все Def приложения с описаниями: модули, агрегаты, UC, ER, Job, события и ошибки агрегатов, доменные правила UC. Ошибки и
   * события, на которые только ссылаются, проверяются у владельца; правило,
   * на которое ссылаются несколько UC, — один раз; заголовок правила — по
   * владельцу его ошибки (`DefIndex.ruleId`), как в графе.
   */
  private described(): DescribedDef[] {
    const out: DescribedDef[] = [];
    const rules = new Set<AnyDomainRule>();
    for (const m of this.index.modules) {
      out.push({ title: `модуль ${m.name}`, ...m.describe() });
      for (const a of m.aggregates) {
        out.push({ title: `агрегат ${m.localId(a)}`, ...a.describe() });
        for (const e of Object.values(a.events)) {
          out.push({ title: `событие ${e.name}`, ...e.describe() });
        }
        for (const e of Object.values(a.errors)) {
          out.push({ title: `ошибка ${e.code}`, ...e.describe() });
        }
      }
      for (const uc of m.useCases) {
        out.push({ title: uc.title(m), ...uc.describe() });
        for (const r of uc.rules) {
          if (rules.has(r)) continue;
          rules.add(r);
          out.push({
            title: `правило ${this.index.ruleId(r).id}`,
            ...r.describe(),
          });
        }
      }
      for (const er of m.reactions) {
        out.push({ title: er.title(m), ...er.describe() });
      }
      for (const job of m.jobs) {
        out.push({ title: job.title(m), ...job.describe() });
      }
    }
    return out;
  }
}
