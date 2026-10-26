import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { DOMAIN_MODULES, DomainArch, domainArchFor } from './domain-arch';

const ROOT = join(import.meta.dir, '..');
const config = await Bun.file(join(ROOT, 'dmg-core.json')).json();

describe('DomainArch.layout', () => {
  it('пути строятся по шаблонам gen с подстановкой {m}', () => {
    const arch = domainArchFor({ domain: 'd/{m}/x', app: 'a/{m}' }, '/r');
    expect(arch.layout('wish')).toEqual({
      domain: '/r/d/wish/x',
      app: '/r/a/wish',
    });
  });

  it('совпадает с путями генератора из dmg-core.json', () => {
    for (const { name } of DOMAIN_MODULES) {
      expect(DomainArch.layout(name)).toEqual({
        domain: join(ROOT, config.gen.domain.replaceAll('{m}', name)),
        app: join(ROOT, config.gen.app.replaceAll('{m}', name)),
      });
    }
  });
});
