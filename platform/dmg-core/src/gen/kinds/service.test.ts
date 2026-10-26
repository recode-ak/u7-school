import { expect, test } from 'bun:test';
import { parseArgs } from '../cli';
import { GenLayout } from '../layout';
import { planDomainService } from './service';

const layout = new GenLayout(
  { domain: '/d/{m}', app: '/p/{m}/src', domainImport: '@acme/domain/{m}' },
  '.',
);

const plan = (kind: 'dcs' | 'dqs', topic: string) =>
  planDomainService(parseArgs([kind, 'stream', topic], layout));

test('dcs: файл и тест по naming.md §2', () => {
  const p = plan('dcs', 'stream-progress');
  expect(p.files.map((f) => f.path)).toEqual([
    '/d/stream/stream-progress.dcs.ts',
    '/d/stream/stream-progress.dcs.test.ts',
  ]);
  const src = p.files[0]?.content ?? '';
  expect(src).toContain('export class StreamProgressDcs {');
  expect(p.files[1]?.content).toContain("describe('StreamProgressDcs'");
  expect(p.files[1]?.content).toContain('new StreamProgressDcs()');
});

test('dqs: суффикс Dqs и файл .dqs.ts', () => {
  const p = plan('dqs', 'stream-navigation');
  expect(p.files.map((f) => f.path)).toEqual([
    '/d/stream/stream-navigation.dqs.ts',
    '/d/stream/stream-navigation.dqs.test.ts',
  ]);
  expect(p.files[0]?.content).toContain('export class StreamNavigationDqs {');
});

test('правка: экспорт в index.ts по маркеру', () => {
  expect(plan('dcs', 'stream-progress').edits).toEqual([
    {
      path: '/d/stream/index.ts',
      marker: '// gen:exports',
      line: "export { StreamProgressDcs } from './stream-progress.dcs';",
    },
  ]);
});
