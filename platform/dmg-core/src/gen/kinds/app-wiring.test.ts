import { describe, expect, it } from 'bun:test';
import { parseArgs } from '../cli';
import { GenLayout } from '../layout';
import { AppWiring, WIRING_MARKERS } from './app-wiring';

type Gen = ConstructorParameters<typeof GenLayout>[0];

const wiring = (gen: Gen, target = 'module stream') =>
  new AppWiring(parseArgs(target.split(' '), new GenLayout(gen, '.')));

const MONO: Gen = {
  domain: '/d/{m}',
  app: '/p/{m}/src',
  domainImport: '@acme/domain/{m}',
  package: '@acme/{m}',
  compositionRoot: 'app/src',
};
const SINGLE: Gen = GenLayout.defaults;
const CUSTOM: Gen = {
  domain: '/d/{m}',
  app: '/p/{m}/src',
  domainImport: '@acme/domain/{m}',
};

describe('AppWiring.moduleEdits', () => {
  it('monorepo: маркеры app.ts и arch-check.ts', () => {
    const edits = wiring(MONO).moduleEdits();
    const { imports, modules, repos } = WIRING_MARKERS;
    expect(edits.map((e) => [e.path, e.marker])).toEqual([
      ['app/src/app.ts', imports],
      ['app/src/app.ts', imports],
      ['app/src/app.ts', modules],
      ['scripts/arch-check.ts', imports],
      ['scripts/arch-check.ts', modules],
    ]);
    expect(edits[2]?.line).toContain(repos('stream'));
  });

  it('monorepo: фабрика импортируется из пакета модуля', () => {
    const lines = wiring(MONO)
      .moduleEdits()
      .map((e) => e.line);
    expect(lines).toContain(
      "import { createStreamModule } from '@acme/stream';",
    );
  });

  it('single: импорты относительные, корень сборки — src/app', () => {
    const edits = wiring(SINGLE).moduleEdits();
    expect(edits.map((e) => e.path)).toContain('src/app/app.ts');
    expect(edits.map((e) => e.line)).toContain(
      "import { createStreamModule } from './stream';",
    );
  });

  it('своя раскладка без compositionRoot — правок нет', () => {
    expect(wiring(CUSTOM).moduleEdits()).toEqual([]);
  });
});

describe('AppWiring.moduleDependencies', () => {
  it('с gen.package — зависимость пакета корня сборки', () => {
    expect(wiring(MONO).moduleDependencies()).toEqual([
      {
        path: 'app/package.json',
        name: '@acme/stream',
        version: 'workspace:*',
      },
    ]);
  });

  it('без gen.package — зависимостей нет', () => {
    expect(wiring(SINGLE).moduleDependencies()).toEqual([]);
  });
});

describe('AppWiring.moduleNotes', () => {
  it('monorepo: напоминание bun install', () => {
    const notes = wiring(MONO).moduleNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('bun install');
  });

  it('без gen.package: подсказок нет', () => {
    expect(wiring(SINGLE).moduleNotes()).toEqual([]);
  });

  it('без compositionRoot — подсказка без правок, с именем пакета', () => {
    const notes = wiring({ ...CUSTOM, package: '@acme/{m}' }).moduleNotes();
    expect(notes[0]).toContain('gen.compositionRoot');
    expect(notes.join('\n')).toContain('"@acme/stream": "workspace:*"');
    expect(notes.at(-1)).toContain('bun install');
  });

  it('корень сборки не на /src — зависимость вручную с каталогом', () => {
    const notes = wiring({ ...MONO, compositionRoot: 'app' }).moduleNotes();
    expect(notes[0]).toContain('Вставь вручную в package.json');
    expect(notes[0]).toContain('"@acme/stream": "workspace:*"');
  });
});

describe('AppWiring.aggregateEdits', () => {
  it('импорт и репозиторий — одна группа с маркерами app.ts', () => {
    const edits = wiring(MONO, 'aggregate stream.student').aggregateEdits(
      'student',
    );
    expect(edits.map((e) => e.marker)).toEqual([
      WIRING_MARKERS.imports,
      WIRING_MARKERS.repos('stream'),
    ]);
    expect(new Set(edits.map((e) => e.group))).toEqual(
      new Set(['repo:stream.student']),
    );
    expect(edits[1]?.line).toContain(
      "join(env.dataDir, 'stream.student.json')",
    );
  });

  it('без compositionRoot — правок нет', () => {
    const w = wiring(CUSTOM, 'aggregate stream.student');
    expect(w.aggregateEdits('student')).toEqual([]);
  });
});
