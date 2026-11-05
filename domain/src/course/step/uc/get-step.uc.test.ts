import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import {
  CourseModuleDef,
  GetStepUcDef,
  ModuleErrors,
  StepErrors,
} from '../../contract';

// Контракт `getStep` (бывш. `get-step-uc`): вход `{ stepId }` (Т8), выход —
// `StepView` (variant по `kind`). Отказ видимости — `ACCESS_DENIED` ядра.

const STEP = '55555555-5555-4555-8555-555555555555';
const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const FILE = '99999999-9999-4999-8999-999999999999';
const T0 = Date.UTC(2026, 6, 8, 18, 35);

const base = {
  uuid: STEP,
  moduleId: MODULE,
  description: 'Шаг 1',
  status: 'published',
  createdAt: T0,
  updatedAt: T0,
  version: 0,
} as const;

describe('GetStepUcDef', () => {
  it('query над агрегатом step для user и guest, allowAll, две ошибки', () => {
    expect(normalize(GetStepUcDef)).toMatchObject({
      name: 'getStep',
      type: 'query',
      aggregate: 'step',
      callers: ['user', 'guest'],
      errors: ['STEP_NOT_FOUND', 'MODULE_NOT_FOUND'],
    });
    expect(GetStepUcDef.policy.op).toBe('allowAll');
  });

  it('ошибки: STEP_NOT_FOUND своя, MODULE_NOT_FOUND — по ссылке (ERR-03)', () => {
    expect(GetStepUcDef.errors).toContain(StepErrors.NOT_FOUND);
    expect(GetStepUcDef.errors).toContain(ModuleErrors.NOT_FOUND);
    expect(StepErrors.NOT_FOUND.kind).toBe('not_found');
  });

  it('вход — uuid шага', () => {
    const { input } = GetStepUcDef;
    expect(v.parse(input, { stepId: STEP })).toEqual({ stepId: STEP });
    expect(v.safeParse(input, { stepId: 'x' }).success).toBe(false);
    expect(v.safeParse(input, { uuid: STEP }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
  });

  it.each([
    ['text', { ...base, kind: 'text', content: 'Текст' }],
    ['text без content', { ...base, kind: 'text' }],
    ['code', { ...base, kind: 'code', code: 'x', language: 'js' }],
    ['code без content и language', { ...base, kind: 'code', code: 'x' }],
    [
      'file',
      {
        ...base,
        kind: 'file',
        file: {
          uuid: FILE,
          name: 'doc.pdf',
          mimeType: 'application/pdf',
          size: 1,
        },
      },
    ],
  ] as const)('выход — StepView: %s валиден', (_, out) => {
    expect(v.parse(GetStepUcDef.output, out)).toEqual(out);
  });

  it.each([
    ['чужой kind', { ...base, kind: 'video' }],
    ['code без code', { ...base, kind: 'code' }],
    ['file без file', { ...base, kind: 'file' }],
    ['пустое описание', { ...base, kind: 'text', description: '' }],
    ['без version', { ...base, kind: 'text', version: undefined }],
  ] as const)('выход: %s — отказ', (_, out) => {
    expect(v.safeParse(GetStepUcDef.output, out).success).toBe(false);
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain('getStep');
  });
});
