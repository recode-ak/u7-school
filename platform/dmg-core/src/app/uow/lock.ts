/**
 * Замок в памяти процесса: задачи идут строго по одной. Нужен хранилищам
 * без транзакций (JSON-файл), чтобы чтение → сверка версии → запись были
 * атомарны внутри процесса (D-36).
 */
export class Lock {
  private tail: Promise<unknown> = Promise.resolve();

  /** Выполнить задачу, дождавшись предыдущих, захваченных этим замком. */
  run<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task);
    this.tail = run.catch(() => undefined);
    return run;
  }
}
