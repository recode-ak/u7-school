import { describe, expect, test } from 'bun:test';
import { LocalZone } from '@u7-scl/app';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import {
  authorLabel,
  OUTCOME_LABELS,
  renderReviewCard,
  renderSchoolReviewCard,
  reviewDate,
  rolesOf,
} from './review-render';

const ZONE = LocalZone.of('Asia/Oral');

describe('reviewDate — дата в зоне школы', () => {
  test('граница суток сдвинута на зону: 18:59Z — 21.09, 19:00Z — уже 22.09', () => {
    expect(reviewDate(Date.parse('2026-09-21T10:00:00Z'), ZONE)).toBe(
      '21.09.2026',
    );
    expect(reviewDate(Date.parse('2026-09-21T18:59:00Z'), ZONE)).toBe(
      '21.09.2026',
    );
    expect(reviewDate(Date.parse('2026-09-21T19:00:00Z'), ZONE)).toBe(
      '22.09.2026',
    );
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

  test('renderReviewCard: автор, поток, дата, текст; спецсимволы экранированы', () => {
    const text = renderReviewCard({
      authorName: 'Анна_К.',
      direction: 'student_student',
      authorOutcome: 'completed_passed',
      streamTitle: 'JS Core (поток 1)',
      createdAt,
      zone: ZONE,
      text: 'Отлично! 5+ баллов - *супер*.',
    });
    assertMarkdownV2Safe(text);
    const s = String(text);
    expect(s).toContain('👤 От: Анна\\_К\\.');
    expect(s).toContain('📚 Поток: JS Core \\(поток 1\\)');
    expect(s).toContain('📅 Дата: 21\\.09\\.2026');
    expect(s).toContain('\\*супер\\*');
  });

  test('renderSchoolReviewCard: дата — в зоне школы (19:00Z — уже следующие сутки)', () => {
    const text = renderSchoolReviewCard({
      mentorName: 'Ментор',
      authorName: 'Анна',
      direction: 'student_mentor',
      streamTitle: 'JS',
      createdAt: Date.parse('2026-09-21T19:00:00Z'),
      zone: ZONE,
      text: 'Хорошо',
    });
    assertMarkdownV2Safe(text);
    expect(String(text)).toContain('📅 Дата: 22\\.09\\.2026');
  });
});
