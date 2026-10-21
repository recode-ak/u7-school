import { describe, expect, test } from 'bun:test';
import { incomingRequestId, jobTrace, requestTrace } from './trace';

describe('requestTrace', () => {
  test('причина — запрос, correlationId по умолчанию — requestId', () => {
    expect(requestTrace({ requestId: 'r-1' })).toEqual({
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'r-1',
    });
  });

  test('correlationId клиента сохраняется', () => {
    const trace = requestTrace({ requestId: 'r-2', correlationId: 'c-1' });
    expect(trace.correlationId).toBe('c-1');
  });
});

describe('jobTrace', () => {
  test('причина — прогон Job, correlationId — его runId', () => {
    const trace = jobTrace();
    expect(trace.cause.kind).toBe('job');
    expect(trace).toEqual({
      cause: { kind: 'job', runId: trace.correlationId },
      correlationId: trace.correlationId,
    });
  });

  test('у каждого прогона свой runId', () => {
    expect(jobTrace().correlationId).not.toBe(jobTrace().correlationId);
  });
});

describe('incomingRequestId', () => {
  test('id клиента — как есть, без сообщений', () => {
    const missing: string[] = [];
    expect(incomingRequestId('r-1', (m) => missing.push(m))).toBe('r-1');
    expect(missing).toEqual([]);
  });

  test('нет id — создаётся и сообщается', () => {
    const missing: string[] = [];
    const id = incomingRequestId(undefined, (m) => missing.push(m));
    expect(missing).toEqual([`Клиент не передал requestId — создан ${id}`]);
  });

  test('пустая строка — то же, что нет id', () => {
    const missing: string[] = [];
    incomingRequestId('', (m) => missing.push(m));
    expect(missing).toHaveLength(1);
  });
});
