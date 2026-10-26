/**
 * Контрактная проверка документации пакета (`docs/`, `skills/`, `agents/`,
 * `llms.txt`): ссылки на файлы живые и не выходят за пределы пакета, ID
 * правил есть в `docs/rules.md`. Запускается тестом `docs-check.test.ts`.
 *
 * Чистая функция над файлами в памяти; чтение диска — в `readDocs`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

/** Файл документации: путь от корня пакета и текст */
export interface DocFile {
  path: string;
  text: string;
}

const DOC_DIRS = ['docs', 'skills', 'agents'];
const DOC_FILES = ['llms.txt', 'README.md'];
const RULES_PATH = 'docs/rules.md';
const LINK_RE = /\]\(([^)\s]+)\)/g;
const RULE_RE = /\b(?:ARC|DOM|MAN|ERR|API|CODE|TST)-\d{2}\b/g;
const EXTERNAL = /^[a-z]+:/i;

export function checkDocs(
  files: readonly DocFile[],
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
      if (resolved.startsWith('..')) {
        violations.push(
          `${file.path}: ссылка выходит за пределы пакета ${target}`,
        );
      } else if (!exists(resolved)) {
        violations.push(
          `${file.path}: ссылка ведёт в несуществующий файл ${target}`,
        );
      }
    }
    const ids = new Set([...file.text.matchAll(RULE_RE)].map((m) => m[0]));
    for (const id of ids) {
      if (!rules.has(id)) {
        violations.push(`${file.path}: правило ${id} нет в ${RULES_PATH}`);
      }
    }
  }
  return violations;
}

/** Документация, проверка существования и ID правил пакета с корнем `root`. */
export function readDocs(root: string) {
  const read = (path: string): DocFile => ({
    path,
    text: readFileSync(join(root, path), 'utf8'),
  });
  const files: DocFile[] = [];
  for (const dir of DOC_DIRS) {
    if (!existsSync(join(root, dir))) continue;
    const names = readdirSync(join(root, dir), { recursive: true })
      .map(String)
      .filter((name) => name.endsWith('.md'))
      .sort();
    for (const name of names) files.push(read(posix.join(dir, name)));
  }
  for (const path of DOC_FILES) {
    if (existsSync(join(root, path))) files.push(read(path));
  }
  const rulesText = readFileSync(join(root, RULES_PATH), 'utf8');
  const rules = new Set(
    [...rulesText.matchAll(/^\| ([A-Z]+-\d{2}) \|/gm)].map((m) => m[1] ?? ''),
  );
  return {
    files,
    exists: (path: string) => existsSync(join(root, path)),
    rules,
  };
}
