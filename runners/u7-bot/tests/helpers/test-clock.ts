import { spyOn } from 'bun:test';
import * as Shared from '@u7-scl/core/shared';

/**
 * Управляемые часы стенда. Приложение берёт «сейчас» из `now()`
 * (`appClock`, D-34), поэтому подмена `now` видна и UC/ER/Job
 * (`this.now()`), и планировщику — прод-код не меняется.
 *
 * Подмена глобальна для процесса: активные часы одни — второй `new TestClock`
до `restore()` бросает ошибку;
 * `restore()` возвращает системное время.
 */
export class TestClock {
  static #active: TestClock | undefined;
  #current: number;
  #spy: ReturnType<typeof spyOn<typeof Shared, 'now'>> | undefined;

  constructor(startAt: number | Date) {
    if (TestClock.#active) {
      throw new Error('TestClock: уже есть активные часы — сначала restore()');
    }
    this.#current = startAt instanceof Date ? startAt.getTime() : startAt;
    this.#spy = spyOn(Shared, 'now').mockImplementation(
      () => new Date(this.#current),
    );
    TestClock.#active = this;
  }

  /** Текущий момент часов, мс. */
  now(): number {
    return this.#current;
  }

  /** Сдвигает время вперёд на `ms`. */
  advance(ms: number): void {
    this.#current += ms;
  }

  /** Ставит время на момент `at`. */
  set(at: number | Date): void {
    this.#current = at instanceof Date ? at.getTime() : at;
  }

  /** Возвращает системные часы. */
  restore(): void {
    this.#spy?.mockRestore();
    this.#spy = undefined;
    if (TestClock.#active === this) TestClock.#active = undefined;
  }
}
