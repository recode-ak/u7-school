/** Выполнить задачу, дождавшись предыдущих, захваченных тем же замком. */
export type Lock = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * Замок в памяти процесса: задачи идут строго по одной. Нужен хранилищам
 * без транзакций (JSON-файл), чтобы чтение → сверка версии → запись были
 * атомарны внутри процесса (D-36).
 */
export function createLock(): Lock {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}
