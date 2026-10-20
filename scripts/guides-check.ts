/**
 * Контрактная проверка гайдов эталона (`conductor/architecture/guides/`):
 * ссылки на файлы и ID правил из `rules.md` живые. Запускается тестом
 * `guides-check.test.ts` (в `bun run check`).
 *
 * Чистая функция над файлами в памяти; чтение диска — в `readGuides`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';

export interface GuideFile {
  path: string;
  text: string;
}

const GUIDES_DIR = 'conductor/architecture/guides';
const RULES_PATH = 'conductor/architecture/rules.md';
const LINK_RE = /\]\(([^)\s]+)\)/g;
const RULE_RE = /\b(?:ARC|DOM|MAN|ERR|API|CODE|TST)-\d{2}\b/g;
const EXTERNAL = /^[a-z]+:/i;

export function checkGuides(
  files: readonly GuideFile[],
  exists: (path: string) => boolean,
  rules: ReadonlySet<string>,
): string[] {
  const violations: string[] = [];
  for (const file of files) {
    for (const [, href = ''] of file.text.matchAll(LINK_RE)) {
      const target = href.split('#')[0] ?? '';
      if (target === '' || EXTERNAL.test(target)) continue;
      const resolved = posix.normalize(
        posix.join(posix.dirname(file.path), target),
      );
      if (!exists(resolved)) {
        violations.push(
          `${file.path}: ссылка ведёт в несуществующий файл ${target}`,
        );
      }
    }
    const ids = new Set([...file.text.matchAll(RULE_RE)].map((m) => m[0]));
    for (const id of ids) {
      if (!rules.has(id)) {
        violations.push(`${file.path}: правило ${id} нет в rules.md`);
      }
    }
  }
  return violations;
}

/** Гайды, проверка существования и ID правил с диска (от корня репозитория). */
export function readGuides() {
  const files = readdirSync(GUIDES_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const path = `${GUIDES_DIR}/${name}`;
      return { path, text: readFileSync(path, 'utf8') };
    });
  const rulesText = readFileSync(RULES_PATH, 'utf8');
  const rules = new Set(
    [...rulesText.matchAll(/^\| ([A-Z]+-\d{2}) \|/gm)].map((m) => m[1] ?? ''),
  );
  return { files, exists: existsSync, rules };
}
