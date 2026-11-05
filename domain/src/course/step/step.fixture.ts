import { MODULE, T0 } from '../module/module.fixture';
import type { StepState } from './step.state';

/** Общие идентификаторы и состояния шагов трёх видов для тестов домена шага. */
export const STEP = '55555555-5555-4555-8555-555555555555';
export const FILE_ID = '99999999-9999-4999-8999-999999999999';

export { MODULE, T0 };

type Of<K extends StepState['kind']> = Extract<StepState, { kind: K }>;

const base = {
  uuid: STEP,
  moduleId: MODULE,
  description: 'Шаг 1',
  createdAt: T0,
  updatedAt: T0,
  version: 0,
} as const;

export const storedText = (
  status: StepState['status'],
  extra: Partial<Of<'text'>> = {},
): StepState => ({
  ...base,
  kind: 'text',
  content: 'Текст шага',
  status,
  ...extra,
});

export const storedCode = (
  status: StepState['status'],
  extra: Partial<Of<'code'>> = {},
): StepState => ({
  ...base,
  kind: 'code',
  code: 'console.log(1)',
  language: 'js',
  status,
  ...extra,
});

export const storedFile = (
  status: StepState['status'],
  extra: Partial<Of<'file'>> = {},
): StepState => ({
  ...base,
  kind: 'file',
  file: {
    uuid: FILE_ID,
    name: 'doc.pdf',
    mimeType: 'application/pdf',
    size: 2048,
  },
  status,
  ...extra,
});
