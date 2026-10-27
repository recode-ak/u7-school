import { Def } from '#core/kernel/def/def';
import type { NormalizedPolicy, PolicySpec } from './policy-def.types';

export type {
  AnyPolicyDef,
  NormalizedPolicy,
  PolicySpec,
} from './policy-def.types';

/** Политика агрегата: именованные правила, на которые ссылаются UC. */
export class PolicyDef<const S extends PolicySpec = PolicySpec> extends Def<
  S['name']
> {
  readonly dmg = 'policy';
  readonly rules: S['rules'];

  constructor(spec: S) {
    super(spec);
    this.rules = spec.rules;
  }

  static define<const S extends PolicySpec>(spec: S): PolicyDef<S> {
    return new PolicyDef(spec);
  }

  normalize(): NormalizedPolicy {
    return {
      dmg: this.dmg,
      ...this.texts(),
      rules: Object.fromEntries(
        Object.entries(this.rules).map(([q, r]) => [q, r.normalize()]),
      ),
    };
  }
}
