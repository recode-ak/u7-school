import { describe, expect, test } from 'bun:test';
import { Trace } from './trace';

describe('Trace.fromRequest', () => {
  test('причина — запрос, correlationId по умолчанию — requestId', () => {
    const trace = Trace.fromRequest({ requestId: 'r-1' });
    expect(trace.cause).toEqual({ kind: 'request', requestId: 'r-1' });
    expect(trace.correlationId).toBe('r-1');
    expect(trace.channel).toBeUndefined();
  });

  test('correlationId клиента сохраняется', () => {
    const trace = Trace.fromRequest({ requestId: 'r-2', correlationId: 'c-1' });
    expect(trace.correlationId).toBe('c-1');
  });

  test('канал входа задаётся на входе', () => {
    const channel = { name: 'telegram', visitorId: '42' };
    const trace = Trace.fromRequest({ requestId: 'r-3', channel });
    expect(trace.channel).toEqual(channel);
  });

  test('id клиента — как есть, без сообщений', () => {
    const missing: string[] = [];
    const trace = Trace.fromRequest({ requestId: 'r-1' }, (m) =>
      missing.push(m),
    );
    expect(trace.cause).toEqual({ kind: 'request', requestId: 'r-1' });
    expect(missing).toEqual([]);
  });

  test('нет id — создаётся и сообщается (ERR-07)', () => {
    const missing: string[] = [];
    const trace = Trace.fromRequest({}, (m) => missing.push(m));
    const { cause } = trace;
    if (cause.kind !== 'request') throw new Error('причина — не запрос');
    expect(cause.requestId).not.toBe('');
    expect(trace.correlationId).toBe(cause.requestId);
    expect(missing).toEqual([
      `Клиент не передал requestId — создан ${cause.requestId}`,
    ]);
  });

  test('пустая строка — то же, что нет id', () => {
    const missing: string[] = [];
    Trace.fromRequest({ requestId: '' }, (m) => missing.push(m));
    expect(missing).toHaveLength(1);
  });
});

describe('Trace.fromEvent', () => {
  test('причина — событие, цепочка — его correlationId', () => {
    const trace = Trace.fromEvent({ eventId: 'e-1', correlationId: 'c-1' });
    expect(trace.cause).toEqual({ kind: 'event', eventId: 'e-1' });
    expect(trace.correlationId).toBe('c-1');
  });
});

describe('Trace.forJob', () => {
  const job = { name: 'archiveDoneTasks' };

  test('причина — прогон Job, correlationId — его runId', () => {
    const trace = Trace.forJob(job);
    expect(trace.cause).toEqual({
      kind: 'job',
      job: 'archiveDoneTasks',
      runId: trace.correlationId,
    });
  });

  test('у каждого прогона свой runId', () => {
    expect(Trace.forJob(job).correlationId).not.toBe(
      Trace.forJob(job).correlationId,
    );
  });
});

describe('Trace.toLog / toEnvelope', () => {
  test('toLog — причина, цепочка и канал (без канала — без поля)', () => {
    expect(Trace.fromRequest({ requestId: 'r-1' }).toLog()).toEqual({
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'r-1',
    });
    const channel = { name: 'web' };
    expect(Trace.fromRequest({ requestId: 'r-1', channel }).toLog()).toEqual({
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'r-1',
      channel,
    });
  });

  test('JSON — как toLog', () => {
    const trace = Trace.fromRequest({ requestId: 'r-1' });
    expect(JSON.parse(JSON.stringify(trace))).toEqual(trace.toLog());
  });

  test('toEnvelope — только причина и цепочка, без канала', () => {
    const trace = Trace.fromRequest({
      requestId: 'r-1',
      correlationId: 'c-1',
      channel: { name: 'web' },
    });
    expect(trace.toEnvelope()).toEqual({
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'c-1',
    });
  });
});

/** Граница процесса: JSON туда и обратно, как в транспорте. */
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('Trace.toJSON / fromJSON — круг через JSON (D-46)', () => {
  const cases: readonly { readonly name: string; readonly trace: Trace }[] = [
    { name: 'запрос', trace: Trace.fromRequest({ requestId: 'r-1' }) },
    {
      name: 'запрос с каналом',
      trace: Trace.fromRequest({
        requestId: 'r-1',
        correlationId: 'c-1',
        channel: { name: 'telegram', visitorId: '42' },
      }),
    },
    {
      name: 'канал без посетителя',
      trace: Trace.fromRequest({ requestId: 'r-1', channel: { name: 'web' } }),
    },
    {
      name: 'событие',
      trace: Trace.fromEvent({ eventId: 'e-1', correlationId: 'c-1' }),
    },
    { name: 'прогон Job', trace: Trace.forJob({ name: 'archiveDoneTasks' }) },
  ];

  for (const { name, trace } of cases) {
    test(`${name}: тот же класс, toLog и toJSON`, () => {
      const restored = Trace.fromJSON(wire(trace.toJSON()));
      expect(restored).toBeInstanceOf(Trace);
      expect(restored.toLog()).toStrictEqual(trace.toLog());
      expect(restored.toJSON()).toStrictEqual(trace.toJSON());
      expect(restored.toEnvelope()).toStrictEqual(trace.toEnvelope());
    });
  }

  test('toJSON — причина, цепочка и канал; без канала — без поля', () => {
    expect(Trace.fromRequest({ requestId: 'r-1' }).toJSON()).toStrictEqual({
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'r-1',
    });
    expect(
      Trace.fromRequest({
        requestId: 'r-1',
        channel: { name: 'web' },
      }).toJSON(),
    ).toStrictEqual({
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'r-1',
      channel: { name: 'web' },
    });
  });

  test('невалидный JSON — Error с понятным текстом', () => {
    for (const bad of [
      null,
      {},
      { cause: { kind: 'request', requestId: 'r-1' } },
      { cause: { kind: 'timer' }, correlationId: 'c-1' },
      { cause: { kind: 'job', job: 'x' }, correlationId: 'c-1' },
      {
        cause: { kind: 'event', eventId: 'e-1' },
        correlationId: 'c-1',
        channel: { visitorId: '42' },
      },
    ]) {
      expect(() => Trace.fromJSON(bad)).toThrow(/Trace\.fromJSON/);
    }
  });
});
