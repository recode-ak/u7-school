import { describe, expect, it } from 'bun:test';
import { StepAr } from './step.ar';
import { StepErrors } from './step.errors';
import {
  FILE_ID,
  MODULE,
  STEP,
  storedCode,
  storedFile,
  storedText,
  T0,
} from './step.fixture';

// Перенос `a-root.test.ts`: `getVisibleFor` (6) на `viewFor(canSeeUnpublished)`.
// Решение «видит ли черновики» принимает Policy модуля-владельца; Ar отвечает
// по готовому флагу. `create` text/code/file (5) — authoring, не переносится;
// виды шага покрывает `step.state.test.ts`.

const statuses = ['draft', 'published', 'archived'] as const;

describe('StepAr.isPublished / moduleId', () => {
  it('published — опубликован', () => {
    expect(StepAr.restore(storedText('published')).isPublished()).toBe(true);
  });

  it.each(['draft', 'archived'] as const)('%s — не опубликован', (status) => {
    expect(StepAr.restore(storedText(status)).isPublished()).toBe(false);
  });

  it('moduleId — модуль-владелец (связь, DOM-04)', () => {
    expect(StepAr.restore(storedText('draft')).moduleId).toBe(MODULE);
  });
});

describe('StepAr.viewFor — без права на неопубликованное (гость, студент)', () => {
  it('draft — undefined (getVisibleFor: «DRAFT → null»)', () => {
    expect(StepAr.restore(storedText('draft')).viewFor(false)).toBeUndefined();
  });

  it('archived — undefined', () => {
    expect(
      StepAr.restore(storedText('archived')).viewFor(false),
    ).toBeUndefined();
  });

  it('published — виден («PUBLISHED → шаг»)', () => {
    expect(
      StepAr.restore(storedText('published')).viewFor(false)?.description,
    ).toBe('Шаг 1');
  });
});

describe('StepAr.viewFor — с правом на неопубликованное (автор, админ)', () => {
  it.each([...statuses])('%s виден', (status) => {
    expect(StepAr.restore(storedText(status)).viewFor(true)?.status).toBe(
      status,
    );
  });

  it('text: представление — состояние шага, даты числами, version', () => {
    expect(StepAr.restore(storedText('published')).viewFor(true)).toMatchObject(
      {
        uuid: STEP,
        moduleId: MODULE,
        kind: 'text',
        description: 'Шаг 1',
        content: 'Текст шага',
        createdAt: T0,
        updatedAt: T0,
        version: 0,
      },
    );
  });

  it('code: код и язык', () => {
    expect(StepAr.restore(storedCode('published')).viewFor(true)).toMatchObject(
      { kind: 'code', code: 'console.log(1)', language: 'js' },
    );
  });

  it('file: метаданные файла', () => {
    expect(StepAr.restore(storedFile('published')).viewFor(true)).toMatchObject(
      {
        kind: 'file',
        file: { uuid: FILE_ID, name: 'doc.pdf', size: 2048 },
      },
    );
  });
});

describe('StepAr.summaryFor — для getStepsByLessons', () => {
  it('published: uuid и description — и только они', () => {
    const summary = StepAr.restore(storedCode('published')).summaryFor(false);
    expect(summary).toEqual({ uuid: STEP, description: 'Шаг 1' });
    expect(Object.keys(summary ?? {}).sort()).toEqual(['description', 'uuid']);
  });

  it.each(['draft', 'archived'] as const)(
    '%s без права — undefined',
    (status) => {
      expect(
        StepAr.restore(storedText(status)).summaryFor(false),
      ).toBeUndefined();
    },
  );
});

describe('StepErrors', () => {
  it('STEP_NOT_FOUND — not_found с payload', () => {
    expect(StepErrors.NOT_FOUND.kind).toBe('not_found');
    expect(StepErrors.NOT_FOUND.make({ stepId: STEP }).payload).toEqual({
      stepId: STEP,
    });
  });
});
