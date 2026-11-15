import type { ReadonlyAr } from 'dmg-core';
import type { WishAr } from './wish/wish.ar';
import type { WishTargetVo } from './wish/wish.state';

/**
 * DQS: выбор желания из загруженных. Только читает. Принимает и `WishAr`
 * (прикладной слой — дальше мутирует), и `ReadonlyAr` (клиент решает тем же
 * вопросом, D-72); возвращает то, что получил.
 */
export class WishSelectionDqs<W extends ReadonlyAr<WishAr>> {
  constructor(private readonly wishes: readonly W[]) {}

  /**
   * Текущее (активное) желание пользователя на цель. Активное на пару одно
   * (`WishRules.unique`), но не обязательно первое: завершённые желания той
   * же пары остаются. Фильтр по пользователю и цели свой — выборке
   * вызывающего не доверяет.
   */
  current(userId: string, target: WishTargetVo): W | undefined {
    return this.wishes.find(
      (wish) => wish.isOwnedBy(userId) && wish.isFor(target) && wish.isActive(),
    );
  }

  /**
   * Последнее желание (отмена): среди активных — последнее созданное, иначе
   * последнее созданное из всех; пусто — `undefined`. Фильтр по пользователю
   * и цели — у выборки (`findAllByUserAndTarget`), метод его не повторяет.
   */
  latest(): W | undefined {
    const active = this.wishes.filter((wish) => wish.isActive());
    const pool = active.length > 0 ? active : this.wishes;
    return pool.reduce<W | undefined>(
      (latest, wish) =>
        latest === undefined || wish.isCreatedAfter(latest) ? wish : latest,
      undefined,
    );
  }
}
