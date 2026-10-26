import { Def } from '#core/kernel/def/def';
import type { NormalizedRules, RulesSpec } from './rules-def.types';

export type {
  AnyRulesDef,
  NormalizedRules,
  RulesSpec,
} from './rules-def.types';

/** Доменные правила агрегата (D-40), на которые ссылаются UC. */
export class RulesDef<const S extends RulesSpec = RulesSpec> extends Def<
  S['name']
> {
  readonly dmg = 'rules';
  readonly rules: S['rules'];

  constructor(spec: S) {
    super(spec);
    this.rules = spec.rules;
  }

  static define<const S extends RulesSpec>(spec: S): RulesDef<S> {
    return new RulesDef(spec);
  }

  normalize(): NormalizedRules {
    return {
      dmg: this.dmg,
      ...this.texts(),
      rules: Object.fromEntries(
        Object.entries(this.rules).map(([k, r]) => [k, r.normalize()]),
      ),
    };
  }
}
