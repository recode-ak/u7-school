import type * as v from 'valibot';
import type { AnyDomainRule } from '../domain/rules/domain-rule-def';
import type { DefIndex } from '../graph/def-index';
import { localId, ruleId } from '../graph/def-index';

/** Def с описаниями и схемами — в виде, общем для MAN-01/02/03. */
export type DescribedDef = {
  /** Вид и id для сообщения: `UC alpha.addNote`. */
  readonly title: string;
  readonly label: string;
  readonly description: string;
  readonly schemas: readonly (readonly [name: string, v.GenericSchema])[];
};

/**
 * Все Def приложения с описаниями: модули, агрегаты, UC, ER, Job, события и ошибки агрегатов, доменные правила UC. Ошибки и
 * события, на которые только ссылаются, проверяются у владельца; правило,
 * на которое ссылаются несколько UC, — один раз; заголовок правила — по
 * владельцу его ошибки (`ruleId`), как в графе.
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
    for (const a of m.aggregates) {
      out.push({ title: `агрегат ${localId(m, a)}`, ...a.describe() });
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
        out.push({ title: `правило ${ruleId(index, r).id}`, ...r.describe() });
      }
    }
    for (const er of m.reactions) {
      out.push({ title: er.title(m), ...er.describe() });
    }
    for (const job of m.jobs) add(`Job ${localId(m, job)}`, job);
  }
  return out;
}
