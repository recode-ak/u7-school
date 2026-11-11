import { describe, expect, it } from 'bun:test';
import { InactivitySweepJobDef } from './inactivity-sweep.job';

// Расписание и сканируемый агрегат Job (MAN-04/05/13); публикует два события
// бездействия — проверяется прогоном джобы в modules/stream.

describe('InactivitySweepJobDef', () => {
  it('имя и расписание: ежедневно 19:00 UTC', () => {
    expect(InactivitySweepJobDef.name).toBe('inactivitySweep');
    expect(InactivitySweepJobDef.schedule).toEqual({
      kind: 'dailyAt',
      hour: 19,
      minute: 0,
    });
  });

  it('сканирует агрегат student', () => {
    expect(InactivitySweepJobDef.scans.map((a) => a.name)).toEqual(['student']);
  });
});
