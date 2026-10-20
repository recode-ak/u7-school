import type * as v from 'valibot';
import type { AnyDomainRule } from '../domain/rules/domain-rule';
import type { DefIndex } from '../graph/def-index';
import { localId } from '../graph/def-index';

/** Def с описаниями и схемами — в виде, общем для MAN-01/02/03. */
export type DescribedDef = {
  /** Вид и id для сообщения: `UC alpha.addNote`. */
  readonly title: string;
  readonly label: string;
  readonly description: string;
  readonly schemas: readonly (readonly [name: string, v.GenericSchema])[];
};

/**
 * Все Def приложения с описаниями: модули, фасады и их методы, агрегаты,
 * UC, ER, Job, события и ошибки агрегатов, доменные правила UC. Ошибки и
 * события, на которые только ссылаются, проверяются у владельца; правило,
 * на которое ссылаются несколько UC, — один раз.
 */
export function describedDefs(index: DefIndex): DescribedDef[] {
  const out: DescribedDef[] = [];
  const rules = new Set<AnyDomainRule>();
  const add = (
    title: string,
    def: { label: string; description: string },
    schemas: DescribedDef['schemas'] = [],
  ): void => {
    out.push({
      title,
      label: def.label,
      description: def.description,
      schemas,
    });
  };
  for (const m of index.modules) {
    add(`модуль ${m.name}`, m);
    if (m.facade) {
      add(`фасад ${m.facade.name}`, m.facade);
      for (const [name, method] of Object.entries(m.facade.methods)) {
        add(`метод фасада ${m.facade.name}.${name}`, method);
      }
    }
    for (const a of m.aggregates) {
      add(`агрегат ${localId(m, a)}`, a, [['state', a.state]]);
      for (const e of Object.values(a.events)) {
        add(`событие ${e.name}`, e, [['payload', e.payload]]);
      }
      for (const e of Object.values(a.errors)) {
        add(`ошибка ${e.code}`, e, e.payload ? [['payload', e.payload]] : []);
      }
    }
    for (const uc of m.useCases) {
      add(`UC ${localId(m, uc)}`, uc, [
        ['input', uc.input],
        ['output', uc.output],
      ]);
      for (const r of uc.rules ?? []) {
        if (rules.has(r)) continue;
        rules.add(r);
        add(`правило ${localId(m, r)}`, r);
      }
    }
    for (const er of m.reactions) add(`ER ${localId(m, er)}`, er);
    for (const job of m.jobs) add(`Job ${localId(m, job)}`, job);
  }
  return out;
}
