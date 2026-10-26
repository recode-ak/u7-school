import type {
  DefDescription,
  DefSchemas,
  DefTexts,
  NormalizedForm,
} from './def.types';

export type {
  DefDescription,
  DefSchemas,
  DefTexts,
  NormalizedForm,
} from './def.types';

/**
 * База манифеста (Def): тексты и поведение, общее для всех видов. Вид —
 * наследник с дискриминатором `dmg`, своими полями и `static define`
 * (у базы его нет: `define` с полиморфным `this` теряет литералы спеки).
 * Без `private`/`#`: типизация Def структурная (`Any*Def`).
 */
export abstract class Def<N extends string = string> {
  abstract readonly dmg: string;
  readonly name: N;
  readonly label: string;
  readonly description: string;

  constructor(spec: DefTexts<N>) {
    this.name = spec.name;
    this.label = spec.label;
    this.description = spec.description;
  }

  /** Сериализуемая форма: ссылки → имена, схемы → JSON Schema (D-27). */
  abstract normalize(): NormalizedForm;

  /** Схемы вида (payload, state, input/output); по умолчанию — нет. */
  schemas(): DefSchemas {
    return [];
  }

  /** Тексты и схемы для проверок манифеста (MAN-01/02/03). */
  describe(): DefDescription {
    return {
      label: this.label,
      description: this.description,
      schemas: this.schemas(),
    };
  }

  /** Тексты в порядке ключей нормализованной формы. */
  texts(): DefTexts<N> {
    return {
      name: this.name,
      label: this.label,
      description: this.description,
    };
  }
}
