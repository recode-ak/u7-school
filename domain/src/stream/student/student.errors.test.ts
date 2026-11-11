import { describe, expect, it } from 'bun:test';
import { StudentErrors } from './student.errors';

describe('StudentErrors — тексты, видимые пользователю', () => {
  it('тексты переходов не содержат сырого статуса (Т10)', () => {
    for (const code of [
      'NOT_STUDYING',
      'NOT_COMPLETABLE',
      'NOT_ENROLLED',
    ] as const) {
      expect(StudentErrors[code].label).not.toMatch(
        /'(enrolled|active|abandoned)'/,
      );
    }
  });
});
