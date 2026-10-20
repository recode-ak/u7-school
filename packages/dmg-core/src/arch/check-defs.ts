import type { JsonSchema } from '@valibot/to-json-schema';
import type { AnyAggregateDef } from '../domain/aggregate/define-aggregate';
import type { AnyModuleDef } from '../domain/contracts/define-module';
import type { AnyEventDef } from '../domain/events/define-events';
import {
  type AnyOperationDef,
  type DefIndex,
  localId,
  operationsOf,
} from '../graph/def-index';
import { CoreErrors } from '../kernel/errors/core-errors';
import type { AnyErrorDef } from '../kernel/errors/define-errors';
import { toJsonSchema } from '../kernel/schema/json-schema';
import { describedDefs } from './described-defs';
import type { ArchRule, Violation } from './violation';

/**
 * Контрактные проверки по Def (без файлов): описания и схемы (MAN-01/02/03),
 * связность (MAN-06), FQN (MAN-08), ссылки ⊆ `dependsOn` (ARC-04), DAG
 * (ARC-05), коды ошибок (ERR-04), отказы переходов (MAN-12).
 */
export function checkDefs(index: DefIndex): Violation[] {
  return [
    ...checkTexts(index),
    ...checkSchemas(index),
    ...checkLinks(index),
    ...checkFqn(index),
    ...checkDependsOn(index),
    ...checkCycles(index),
    ...checkErrorCodes(index),
    ...checkRejects(index),
  ];
}

const violation = (rule: ArchRule, message: string): Violation => ({
  rule,
  message,
});

function checkTexts(index: DefIndex): Violation[] {
  const out: Violation[] = [];
  for (const d of describedDefs(index)) {
    if (d.label.trim() === '') {
      out.push(violation('MAN-01', `${d.title}: пустой label`));
    }
    if (d.description.trim() === '') {
      out.push(violation('MAN-01', `${d.title}: пустой description`));
    }
  }
  return out;
}

function checkSchemas(index: DefIndex): Violation[] {
  const out: Violation[] = [];
  for (const d of describedDefs(index)) {
    for (const [name, schema] of d.schemas) {
      let json: JsonSchema;
      try {
        json = toJsonSchema(schema);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        out.push(
          violation(
            'MAN-03',
            `${d.title} ${name}: не переводится в JSON Schema — ${reason}`,
          ),
        );
        continue;
      }
      for (const field of undocumented(json, '')) {
        out.push(
          violation(
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
function undocumented(s: JsonSchema | boolean, path: string): string[] {
  if (typeof s === 'boolean') return [];
  const out: string[] = [];
  for (const [key, prop] of Object.entries(s.properties ?? {})) {
    const field = path === '' ? key : `${path}.${key}`;
    if (typeof prop !== 'boolean' && prop.description === undefined) {
      out.push(field);
    }
    out.push(...undocumented(prop, field));
  }
  if (s.items !== undefined && !Array.isArray(s.items)) {
    out.push(...undocumented(s.items, `${path}[]`));
  }
  for (const variant of [...(s.anyOf ?? []), ...(s.oneOf ?? [])]) {
    out.push(...undocumented(variant, path));
  }
  return out;
}

function checkLinks(index: DefIndex): Violation[] {
  const out: Violation[] = [];
  const add = (message: string): void => {
    out.push(violation('MAN-06', message));
  };
  const published = new Set<AnyEventDef>();
  for (const op of index.operationOwner.keys()) {
    for (const e of op.emits ?? []) published.add(e);
  }
  const eventModule = (e: AnyEventDef): AnyModuleDef | undefined => {
    const a = index.eventOwner.get(e);
    return a && index.aggregateOwner.get(a);
  };
  const checkErrors = (title: string, errors: readonly AnyErrorDef[]) => {
    for (const e of errors) {
      if (!index.errorOwner.has(e) && !isCoreError(e)) {
        add(`${title}: ошибка ${e.code} не входит ни в один модуль`);
      }
    }
  };

  for (const m of index.modules) {
    for (const op of operationsOf(m)) {
      const title = operationTitle(m, op);
      for (const a of aggregatesOf(op)) {
        const owner = index.aggregateOwner.get(a);
        if (owner === undefined) {
          add(`${title}: агрегат ${a.name} не входит ни в один модуль`);
        } else if (owner !== m) {
          add(`${title}: агрегат ${localId(owner, a)} другого модуля`);
        }
      }
      for (const e of op.emits ?? []) {
        const owner = eventModule(e);
        if (owner === undefined) {
          add(`${title}: событие ${e.name} не входит ни в один модуль`);
        } else if (owner !== m) {
          add(`${title}: публикует событие ${e.name} другого модуля`);
        }
      }
      switch (op.dmg) {
        case 'useCase':
          checkErrors(title, op.errors);
          break;
        case 'eventReaction':
          for (const e of op.on) {
            if (eventModule(e) === undefined) {
              add(`${title}: событие ${e.name} не входит ни в один модуль`);
            } else if (!published.has(e)) {
              add(`${title} слушает ${e.name}, которое никто не публикует`);
            }
          }
          for (const f of op.calls) {
            if (!index.facadeOwner.has(f)) {
              add(`${title}: фасад ${f.name} не входит ни в один модуль`);
            }
          }
          break;
        case 'job':
          break;
      }
    }
    if (m.facade) {
      for (const method of Object.values(m.facade.methods)) {
        checkErrors(`фасад ${m.facade.name}`, method.errors);
      }
    }
  }

  for (const m of index.modules) {
    for (const a of m.aggregates) {
      for (const e of Object.values(a.events)) {
        if (!published.has(e)) add(`событие ${e.name} никто не публикует`);
      }
    }
  }
  return out;
}

function checkFqn(index: DefIndex): Violation[] {
  const out: Violation[] = [];
  for (const m of index.modules) {
    for (const a of m.aggregates) {
      const prefix = `${m.name}.${a.name}.`;
      for (const e of Object.values(a.events)) {
        const rest = e.name.slice(prefix.length);
        if (!e.name.startsWith(prefix) || rest === '' || rest.includes('.')) {
          out.push(
            violation(
              'MAN-08',
              `событие ${e.name} агрегата ${localId(m, a)}: ожидается префикс ${prefix}`,
            ),
          );
        }
      }
    }
  }
  return out;
}

/** MAN-12: отказы переходов — ошибки из группы самого агрегата. */
function checkRejects(index: DefIndex): Violation[] {
  const out: Violation[] = [];
  for (const m of index.modules) {
    for (const a of m.aggregates) {
      const own = new Set(Object.values(a.errors));
      for (const [op, t] of Object.entries(a.transitions ?? {})) {
        for (const e of Object.values(t.rejects)) {
          if (e === undefined || own.has(e)) continue;
          out.push(
            violation(
              'MAN-12',
              `агрегат ${localId(m, a)}, переход ${op}: отказ ${e.code} не из ошибок агрегата`,
            ),
          );
        }
      }
    }
  }
  return out;
}

function checkDependsOn(index: DefIndex): Violation[] {
  const out: Violation[] = [];
  for (const m of index.modules) {
    const check = (title: string, what: string, owner?: AnyModuleDef) => {
      if (owner && owner !== m && !m.dependsOn.includes(owner)) {
        out.push(
          violation(
            'ARC-04',
            `${title}: ${what} модуля ${owner.name}, которого нет в dependsOn ${m.name}`,
          ),
        );
      }
    };
    const checkErrors = (title: string, errors: readonly AnyErrorDef[]) => {
      for (const e of errors) {
        const a = index.errorOwner.get(e);
        check(title, `ошибка ${e.code}`, a && index.aggregateOwner.get(a));
      }
    };
    for (const op of operationsOf(m)) {
      const title = operationTitle(m, op);
      switch (op.dmg) {
        case 'useCase':
          checkErrors(title, op.errors);
          break;
        case 'eventReaction':
          for (const e of op.on) {
            const a = index.eventOwner.get(e);
            check(title, `событие ${e.name}`, a && index.aggregateOwner.get(a));
          }
          for (const f of op.calls) {
            check(title, `фасад ${f.name}`, index.facadeOwner.get(f));
          }
          break;
        case 'job':
          break;
      }
    }
    if (m.facade) {
      for (const method of Object.values(m.facade.methods)) {
        checkErrors(`фасад ${m.facade.name}`, method.errors);
      }
    }
  }
  return out;
}

function checkCycles(index: DefIndex): Violation[] {
  const out: Violation[] = [];
  const done = new Set<AnyModuleDef>();
  const stack: AnyModuleDef[] = [];
  const visit = (m: AnyModuleDef): void => {
    if (done.has(m)) return;
    const at = stack.indexOf(m);
    if (at >= 0) {
      const path = [...stack.slice(at), m].map((x) => x.name).join(' → ');
      out.push(violation('ARC-05', `цикл dependsOn: ${path}`));
      return;
    }
    stack.push(m);
    for (const dep of m.dependsOn) visit(dep);
    stack.pop();
    done.add(m);
  };
  for (const m of index.modules) visit(m);
  return out;
}

function checkErrorCodes(index: DefIndex): Violation[] {
  const out: Violation[] = [];
  const byCode = new Map<string, Set<AnyErrorDef>>();
  const add = (e: AnyErrorDef): void => {
    const defs = byCode.get(e.code) ?? new Set();
    defs.add(e);
    byCode.set(e.code, defs);
  };
  for (const e of Object.values(CoreErrors)) add(e);
  for (const m of index.modules) {
    for (const a of m.aggregates) {
      const prefix = `${upperSnake(a.name)}_`;
      for (const e of Object.values(a.errors)) {
        if (!e.code.startsWith(prefix)) {
          out.push(
            violation(
              'ERR-04',
              `ошибка ${e.code} агрегата ${localId(m, a)}: ожидается префикс ${prefix}`,
            ),
          );
        }
        add(e);
      }
    }
    for (const uc of m.useCases) for (const e of uc.errors) add(e);
    for (const method of Object.values(m.facade?.methods ?? {})) {
      for (const e of method.errors) add(e);
    }
  }
  for (const [code, defs] of byCode) {
    if (defs.size > 1) {
      out.push(
        violation('ERR-04', `код ${code} объявлен в ${defs.size} разных Def`),
      );
    }
  }
  return out;
}

const OPERATION_KIND = { useCase: 'UC', eventReaction: 'ER', job: 'Job' };

function operationTitle(m: AnyModuleDef, op: AnyOperationDef): string {
  return `${OPERATION_KIND[op.dmg]} ${localId(m, op)}`;
}

function aggregatesOf(op: AnyOperationDef): readonly AnyAggregateDef[] {
  switch (op.dmg) {
    case 'useCase':
      return [op.aggregate];
    case 'eventReaction':
      return op.touches;
    case 'job':
      return op.scans;
  }
}

function isCoreError(e: AnyErrorDef): boolean {
  return Object.values<AnyErrorDef>(CoreErrors).includes(e);
}

/** `studentProgress` → `STUDENT_PROGRESS`. */
function upperSnake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}
