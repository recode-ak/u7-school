import { describe, expect, test } from 'bun:test';
import { Marker } from './marker';

const marker = new Marker('1.2.3');

describe('Marker', () => {
  test('ставит метку после frontmatter', () => {
    const text = '---\nname: x\n---\n\nТело.\n';
    expect(marker.mark(text)).toBe(
      `---\nname: x\n---\n\n${marker.comment}\n\nТело.\n`,
    );
  });

  test('без frontmatter — метка в начале', () => {
    expect(marker.mark('Текст.\n')).toBe(`${marker.comment}\n\nТекст.\n`);
  });

  test('метка несёт версию и узнаётся', () => {
    expect(marker.comment).toContain('dmg-core@1.2.3');
    expect(Marker.versionOf(marker.mark('Текст.'))).toBe('1.2.3');
    expect(Marker.versionOf('Текст без метки.')).toBeUndefined();
  });

  test('strip убирает метку — круг mark → strip без потерь', () => {
    const text = '---\nname: x\n---\n\nТело.\n';
    expect(Marker.strip(marker.mark(text))).toBe(text);
    expect(Marker.strip(marker.mark('Текст.\n'))).toBe('Текст.\n');
  });
});
