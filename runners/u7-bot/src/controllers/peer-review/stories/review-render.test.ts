import { describe, expect, test } from 'bun:test';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import {
  authorLabel,
  authorLine,
  OUTCOME_LABELS,
  renderReviewCard,
  reviewDate,
  rolesOf,
} from './review-render';

describe('reviewDate — дата по UTC из числа', () => {
  test('около полуночи UTC дата не сдвигается зоной процесса', () => {
    expect(reviewDate(Date.UTC(2026, 8, 21, 10, 0))).toBe('21.09.2026');
    expect(reviewDate(Date.parse('2026-09-21T23:30:00Z'))).toBe('21.09.2026');
    expect(reviewDate(Date.parse('2026-09-22T00:00:00Z'))).toBe('22.09.2026');
  });
});

describe('роли и подписи автора', () => {
  test('rolesOf по направлению', () => {
    expect(rolesOf('student_student')).toEqual({
      recipient: 'студент',
      author: 'студент',
    });
    expect(rolesOf('student_mentor')).toEqual({
      recipient: 'ментор',
      author: 'студент',
    });
    expect(rolesOf('mentor_student')).toEqual({
      recipient: 'студент',
      author: 'ментор',
    });
  });

  test('лейбл исхода — только у автора-студента', () => {
    expect(
      authorLabel({
        direction: 'student_mentor',
        authorOutcome: 'dropped',
      }),
    ).toBe(`студент · ${OUTCOME_LABELS.dropped}`);
    expect(
      authorLabel({
        direction: 'mentor_student',
        authorOutcome: 'dropped',
      }),
    ).toBe('ментор');
  });
});

describe('рендер карточек (MarkdownV2)', () => {
  const createdAt = Date.UTC(2026, 8, 21, 10);

  test('authorLine: имя, роль, исход и дата', () => {
    const text = authorLine({
      name: 'Анна',
      direction: 'student_student',
      authorOutcome: 'completed_passed',
      createdAt,
    });
    assertMarkdownV2Safe(text);
    expect(String(text)).toContain('Анна');
    expect(String(text)).toContain('студент · завершил и прошел');
    expect(String(text)).toContain('21\\.09\\.2026');
  });

  test('renderReviewCard: автор, поток, дата, текст; спецсимволы экранированы', () => {
    const text = renderReviewCard({
      authorName: 'Анна_К.',
      direction: 'student_student',
      authorOutcome: 'completed_passed',
      streamTitle: 'JS Core (поток 1)',
      createdAt,
      text: 'Отлично! 5+ баллов - *супер*.',
    });
    assertMarkdownV2Safe(text);
    const s = String(text);
    expect(s).toContain('👤 От: Анна\\_К\\.');
    expect(s).toContain('📚 Поток: JS Core \\(поток 1\\)');
    expect(s).toContain('📅 Дата: 21\\.09\\.2026');
    expect(s).toContain('\\*супер\\*');
  });
});
