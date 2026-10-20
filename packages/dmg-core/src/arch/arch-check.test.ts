import { describe, expect, it } from 'bun:test';
import { ExampleArch } from '../testing/example/example.arch';
import { archCheck } from './arch-check';

describe('archCheck', () => {
  it('учебный пример (todo + users) — без нарушений', () => {
    expect(archCheck(ExampleArch)).toEqual([]);
  });

  it('пустой домен — без нарушений', () => {
    const empty = { name: 'empty', modules: [], layout: ExampleArch.layout };
    expect(archCheck(empty)).toEqual([]);
  });
});
