import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { DomainArch } from './domain-arch';

const ROOT = join(import.meta.dir, '..');

describe('DomainArch.layout', () => {
  it('раскладка проекта: домен — domain/src, прикладной слой — modules', () => {
    expect(DomainArch.layout('wish')).toEqual({
      domain: join(ROOT, 'domain/src/wish'),
      app: join(ROOT, 'modules/wish/src'),
    });
  });
});
