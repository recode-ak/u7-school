/**
 * `migrate-users-drop-student` — идемпотентная миграция данных под снятие роли
 * `STUDENT`: снимает её из `roles` записей `users.json`, опустевший список
 * заменяет на `['GUEST']`. Остальные поля и порядок записей не трогает (D-36).
 *
 * ⚠️ Порядок на проде. Миграция — ДО выкатки нового кода: новый код читает
 * `users.json` строгой схемой и на записи со `STUDENT` роняет все чтения `user`.
 * 1. Остановить бота: `bun run start:prod:stop`.
 * 2. Защищённый снимок: `bun run backup --name=before-drop-student`.
 * 3. Сухой прогон: `bun run scripts/migrate-users-drop-student.ts`.
 * 4. Разобрать `invalid` из итога — записи не чинятся и не удаляются.
 * 5. Запись: `bun run scripts/migrate-users-drop-student.ts --write`.
 * 6. Контрольное чтение `data/users/users.json`: `STUDENT` не осталось.
 * 7. Деплой нового кода, затем `bun run start:prod`.
 *
 * Без подтверждения владельца данных на проде не запускать.
 *
 * Использование:
 *   bun run scripts/migrate-users-drop-student.ts
 *   DB_DIR=./data/fixtures bun run scripts/migrate-users-drop-student.ts
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UserArDef } from '@u7-scl/domain/user';
import * as v from 'valibot';

/** Роль, снимаемая миграцией; в схеме домена её больше нет (ERR-01). */
const DROPPED_ROLE = 'STUDENT';
/** Роль, остающаяся у записи, если после снятия `STUDENT` ролей не стало. */
const FALLBACK_ROLE = 'GUEST';

export interface InvalidUser {
  /** `uuid` записи, без него — индекс в файле строкой. */
  id: string;
  /** Текст первой ошибки разбора `UserArDef.state`. */
  issue: string;
}

export interface MigrateUsersResult {
  total: number;
  migrated: number;
  becameGuest: number;
  invalid: InvalidUser[];
  written: boolean;
}

const issueText = (issue: v.BaseIssue<unknown>): string => {
  const pathText = (issue.path ?? []).map((item) => String(item.key)).join('.');

  return pathText === '' ? issue.message : `${pathText}: ${issue.message}`;
};

/**
 * Идемпотентно снимает `STUDENT` с сырых записей `users.json`. Записи без
 * `STUDENT` возвращаются теми же объектами; исходный массив не мутируется.
 * Проверка — строгая схема записи (`UserArDef.state`): она же читает legacy
 * без `updatedAt`/`version` (D-36), поэтому он не считается невалидным.
 */
export function migrateUsersData(users: Array<Record<string, unknown>>): {
  updatedUsers: Array<Record<string, unknown>>;
  result: MigrateUsersResult;
} {
  let migrated = 0;
  let becameGuest = 0;
  const invalid: InvalidUser[] = [];

  const updatedUsers = users.map((user, index) => {
    let next = user;
    const { roles } = user;

    if (Array.isArray(roles) && roles.includes(DROPPED_ROLE)) {
      migrated++;
      const kept: unknown[] = roles.filter((role) => role !== DROPPED_ROLE);
      if (kept.length === 0) {
        kept.push(FALLBACK_ROLE);
        becameGuest++;
      }
      next = { ...user, roles: kept };
    }

    const parsed = v.safeParse(UserArDef.state, next);
    if (!parsed.success) {
      const [issue] = parsed.issues;
      invalid.push({
        id: typeof next.uuid === 'string' ? next.uuid : String(index),
        issue: issue ? issueText(issue) : 'неизвестная ошибка разбора',
      });
    }

    return next;
  });

  return {
    updatedUsers,
    result: {
      total: users.length,
      migrated,
      becameGuest,
      invalid,
      written: false,
    },
  };
}

/**
 * Путь к файлу пользователей: вложенный `<dbDir>/users/users.json`, иначе
 * плоский `<dbDir>/users.json`, иначе вложенный (его и создают).
 */
export function resolveUsersFilePath(dbDir: string): string {
  const nested = path.join(dbDir, 'users', 'users.json');
  if (existsSync(nested)) return nested;

  const flat = path.join(dbDir, 'users.json');
  if (existsSync(flat)) return flat;

  return nested;
}

const emptyResult = (): MigrateUsersResult => ({
  total: 0,
  migrated: 0,
  becameGuest: 0,
  invalid: [],
  written: false,
});

const printResult = (filePath: string, result: MigrateUsersResult): void => {
  console.log(`📄 Файл: ${filePath}`);
  console.log(`   всего записей: ${result.total}`);
  console.log(`   снят ${DROPPED_ROLE}: ${result.migrated}`);
  console.log(`   получили ['${FALLBACK_ROLE}']: ${result.becameGuest}`);
  console.log(`   записано: ${result.written ? 'да' : 'нет (сухой прогон)'}`);
  for (const { id, issue } of result.invalid) {
    console.warn(`⚠️ Невалидная запись ${id}: ${issue}`);
  }
};

/**
 * Прогон миграции по каталогу данных. По умолчанию сухой: считает и печатает
 * итог, файл пишет только при `write` и только если есть что менять.
 */
export async function runMigration(
  dbDir: string,
  options: { write?: boolean } = {},
): Promise<MigrateUsersResult> {
  const filePath = resolveUsersFilePath(dbDir);

  if (!existsSync(filePath)) {
    console.log(`ℹ️ Файл пользователей не найден: ${filePath}`);
    return emptyResult();
  }

  const raw = await readFile(filePath, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Не удалось распарсить JSON файл ${filePath}: ${err}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(
      `Файл ${filePath} содержит некорректный формат: ожидался массив пользователей.`,
    );
  }

  const { updatedUsers, result } = migrateUsersData(
    data as Array<Record<string, unknown>>,
  );

  const written = options.write === true && result.migrated > 0;
  if (written) {
    await writeFile(filePath, JSON.stringify(updatedUsers, null, 2), 'utf-8');
  }

  const finalResult = { ...result, written };
  printResult(filePath, finalResult);

  return finalResult;
}

if (import.meta.main) {
  const dbDir = process.env.DB_DIR || 'data';
  const write = process.argv.includes('--write');
  const mode = write ? 'запись' : 'сухой прогон';
  console.log(`🚀 Снятие роли ${DROPPED_ROLE} (${mode}, каталог: ${dbDir})...`);

  runMigration(dbDir, { write })
    .then((result) => {
      console.log('🎉 Готово:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Ошибка миграции:', err);
      process.exit(1);
    });
}
