import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Step } from '@u7-scl/domain/course';
import { Status } from '@u7-scl/domain/course';
import { LegacyStepJsonRepo } from './step-json-repo';

const tmpDir = mkdtempSync('/tmp/step-repo-test-');

function filePath(): string {
  return join(tmpDir, 'steps.json');
}

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    uuid: crypto.randomUUID(),
    moduleId: crypto.randomUUID(),
    kind: 'text' as const,
    description: 'Тестовый шаг',
    status: Status.DRAFT,
    createdAt: '2026-05-01T12:00',
    ...overrides,
  } as Step;
}

describe('LegacyStepJsonRepo', () => {
  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('save и getByUuid', async () => {
    const repo = new LegacyStepJsonRepo(filePath());
    const uuid = crypto.randomUUID();
    const step = makeStep({ uuid });

    await repo.save(step);
    const found = await repo.getByUuid(uuid);

    expect(found).toBeDefined();
    expect(found?.description).toBe('Тестовый шаг');
  });

  test('getByIds возвращает шаги по списку ID', async () => {
    const repo = new LegacyStepJsonRepo(join(tmpDir, 'steps-ids.json'));
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const s1 = makeStep({ uuid: id1 });
    const s2 = makeStep({ uuid: id2 });

    await repo.save(s1);
    await repo.save(s2);

    const result = await repo.getByIds([id1]);
    expect(result).toHaveLength(1);
    expect(result[0]?.uuid).toBe(id1);
  });
});
