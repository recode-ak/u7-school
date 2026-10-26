/**
 * Детерминированное ожидание обработки события из шины в тестах ER.
 * Шина не ждёт обработчик, но `subscribe` вызывает `er.handle` — запоминаем
 * его промисы и отдаём «дождаться всех» вместо опроса по таймеру.
 */
export function trackHandling<A extends unknown[]>(er: {
  handle: (...args: A) => Promise<unknown>;
}): () => Promise<void> {
  const pending: Promise<unknown>[] = [];
  const handle = er.handle.bind(er);
  er.handle = (...args: A) => {
    const done = handle(...args);
    pending.push(done);
    return done;
  };
  return async () => {
    await Promise.all(pending);
  };
}
