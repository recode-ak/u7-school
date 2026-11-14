import { describe, expect, it } from 'bun:test';
import { StreamAr } from './stream.ar';
import { stored } from './stream.fixture';
import type { StreamState } from './stream.state';

type Status = StreamState['status'];

const restore = (status: Status) => StreamAr.restore(stored(status));

/**
 * Вопросы допустимости перехода (F-43, D-72): UI решает по ним, а не по
 * `status` из view. Источник правды — `StreamArDef.transitions.<op>.from`.
 */
const matrix: ReadonlyArray<{
  status: Status;
  canActivate: boolean;
  canComplete: boolean;
  canArchive: boolean;
  isEnrolling: boolean;
}> = [
  {
    status: 'enrollment',
    canActivate: true,
    canComplete: false,
    canArchive: false,
    isEnrolling: true,
  },
  {
    status: 'active',
    canActivate: false,
    canComplete: true,
    canArchive: false,
    isEnrolling: false,
  },
  {
    status: 'completed',
    canActivate: false,
    canComplete: false,
    canArchive: true,
    isEnrolling: false,
  },
  {
    status: 'archived',
    canActivate: false,
    canComplete: false,
    canArchive: false,
    isEnrolling: false,
  },
];

describe('StreamAr.canActivate', () => {
  for (const row of matrix) {
    it(`статус ${row.status} → ${row.canActivate}`, () => {
      expect(restore(row.status).canActivate()).toBe(row.canActivate);
    });
  }
});

describe('StreamAr.canComplete', () => {
  for (const row of matrix) {
    it(`статус ${row.status} → ${row.canComplete}`, () => {
      expect(restore(row.status).canComplete()).toBe(row.canComplete);
    });
  }
});

describe('StreamAr.canArchive', () => {
  for (const row of matrix) {
    it(`статус ${row.status} → ${row.canArchive}`, () => {
      expect(restore(row.status).canArchive()).toBe(row.canArchive);
    });
  }
});

describe('StreamAr.isEnrolling', () => {
  for (const row of matrix) {
    it(`статус ${row.status} → ${row.isEnrolling}`, () => {
      expect(restore(row.status).isEnrolling()).toBe(row.isEnrolling);
    });
  }
});
