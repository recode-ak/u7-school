import { describe, expect, test } from 'bun:test';
import { SensitiveMask } from 'dmg-core';
import { EnrollStudentUcDef } from '../student/uc/enroll-student.uc';
import { StreamState } from './stream.state';

const mask = new SensitiveMask();

describe('stream: места с персональными данными помечены F.sensitive', () => {
  test.each([
    {
      place: 'state: enrollmentKey',
      schema: StreamState,
      path: 'enrollmentKey',
    },
    {
      place: 'state: telegramGroupInvite',
      schema: StreamState,
      path: 'telegramGroupInvite',
    },
    {
      place: 'enrollStudent: вход enrollmentKey',
      schema: EnrollStudentUcDef.input,
      path: 'enrollmentKey',
    },
  ])('$place', ({ schema, path }) => {
    expect(mask.isSensitive(schema, path)).toBe(true);
  });
});
