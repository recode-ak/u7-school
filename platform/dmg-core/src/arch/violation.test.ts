import { describe, expect, it } from 'bun:test';
import { Violation } from './violation';

describe('Violation', () => {
  it('хранит правило и сообщение', () => {
    const v = new Violation('MAN-01', 'модуль todo: пустой label');
    expect(v.rule).toBe('MAN-01');
    expect(v.message).toBe('модуль todo: пустой label');
  });

  it('format() — строка отчёта, начинается с ID правила', () => {
    expect(new Violation('ARC-04', 'цикл a → b → a').format()).toBe(
      'ARC-04: цикл a → b → a',
    );
  });
});
