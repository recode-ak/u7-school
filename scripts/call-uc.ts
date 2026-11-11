/**
 * call-uc — утилита для вызова UseCase из командной строки.
 * Отдельный от u7-cli ручной вход; свести с ним после перехода.
 *
 * Собирает то же приложение, что и бот — корень сборки `U7App`
 * (`@u7-scl/app`, D-50) над `data/`, — но без Telegram-интерфейса.
 *
 * Использование:
 *   bun run scripts/call-uc.ts <usecase> '<json-params>' [actorId]
 *
 * Примеры:
 *   bun run scripts/call-uc.ts list-modules '{}'
 *   bun run scripts/call-uc.ts get-user '{"uuid":"<uuid>"}'
 *   bun run scripts/call-uc.ts list-users '{}'
 *   bun run scripts/call-uc.ts get-module '{"moduleId":"<uuid>"}'
 *   bun run scripts/call-uc.ts get-module-snapshot '{"moduleId":"<uuid>"}'
 *   bun run scripts/call-uc.ts get-lesson '{"lessonId":"<uuid>"}'
 *   bun run scripts/call-uc.ts get-step '{"stepId":"<uuid>"}'
 *   bun run scripts/call-uc.ts get-questionnaires-by-user '{"userId":"<uuid>"}'
 *   bun run scripts/call-uc.ts get-current '{"questionnaireId":"<uuid>"}'
 *   bun run scripts/call-uc.ts create-course-wish '{"courseId":"<uuid>"}'
 *
 * UC модулей user, course, wish и questionnaire — DMG: команда через
 * `ApiApp.dispatch` (D-49) над той же сборкой, что и в боте (`U7App`),
 * субъект — резолвер `app.callers`; имя — kebab-case (`create-course-wish`)
 * или имя Def (`createCourseWish`). Отказ — `Err` с кодом в stderr и выход
 * с кодом 1. Лог операций DMG пишется в `data/oplog/`, как у бота.
 *
 * UC `stream` перешли на DMG (модуль `stream`), но через `call-uc` пока не
 * вызываются: скрипт знает DMG-модули `user`, `course`, `wish` и
 * `questionnaire`.
 *
 * ⚠️ Команды (не query) пишут в боевые JSON-файлы: перед изменяющими
 * вызовами убедись, что бот остановлен (pm2 stop u7-school-bot).
 * Реакции модулей подписаны, как в боте: событие команды запускает их
 * побочные эффекты (например, смена судьбы студента в `stream` создаёт
 * кампанию в `data/peer-review/`, ER `wish` — свои записи).
 *
 * По умолчанию авторизация: Nur (ADMIN + MENTOR).
 * actorId можно переопределить третьим аргументом.
 */

import { U7App } from '@u7-scl/app';
import { TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import { ConsoleLogger } from '@u7-scl/core/shared';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { WishModuleDef } from '@u7-scl/domain/wish/contract';
import {
  type AnyModuleDef,
  type AnyUseCaseDef,
  type InputOf,
  UseCaseDef,
} from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { NUR_UUID } from './_course-client';

/** `createCourseWish` → `create-course-wish`. */
const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** DMG-модули, UC которых вызываются через `dispatch` (D-49). */
const DMG_MODULES: readonly AnyModuleDef[] = [
  UserModuleDef,
  CourseModuleDef,
  WishModuleDef,
  QuestionnaireModuleDef,
];

/** UC DMG-модуля по имени: kebab-case или имя Def. */
function findDmgUc(
  ucName: string,
): { moduleDef: AnyModuleDef; ucDef: AnyUseCaseDef } | undefined {
  for (const moduleDef of DMG_MODULES) {
    const ucDef = moduleDef.useCases.find(
      (def) => def.name === ucName || kebab(def.name) === ucName,
    );
    if (ucDef !== undefined) return { moduleDef, ucDef };
  }
  return undefined;
}

function printHelp() {
  console.log(`
Использование:
  bun run scripts/call-uc.ts <usecase> '<json-params>' [actorId]

Параметры:
  usecase      — название use case (обязательно)
  json-params  — параметры в JSON (обязательно, можно '{}')
  actorId      — UUID пользователя (опционально, по умолчанию Nur)

Доступные модули: user, course, wish, questionnaire (DMG).
UC stream (DMG) через call-uc пока не вызываются.

Примеры:
  bun run scripts/call-uc.ts list-modules '{}'
  bun run scripts/call-uc.ts get-user '{"uuid":"<uuid>"}'
  bun run scripts/call-uc.ts list-users '{}'
  bun run scripts/call-uc.ts get-module '{"moduleId":"<uuid>"}'
  bun run scripts/call-uc.ts get-module-snapshot '{"moduleId":"<uuid>"}'
  bun run scripts/call-uc.ts get-lesson '{"lessonId":"<uuid>"}'
  bun run scripts/call-uc.ts get-step '{"stepId":"<uuid>"}'
  bun run scripts/call-uc.ts list-courses '{}'
  bun run scripts/call-uc.ts get-questionnaires-by-user '{"userId":"<uuid>"}'
  bun run scripts/call-uc.ts get-current '{"questionnaireId":"<uuid>"}'
  bun run scripts/call-uc.ts create-course-wish '{"courseId":"<uuid>"}'
  bun run scripts/call-uc.ts --help
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const [ucName, paramsJson, actorIdOverride] = args;

  if (!ucName) {
    console.error('❌ Ошибка: не указан use case');
    printHelp();
    process.exit(1);
  }

  let params: Record<string, unknown>;
  try {
    params = paramsJson ? JSON.parse(paramsJson) : {};
  } catch {
    console.error('❌ Ошибка: параметры должны быть в формате JSON');
    console.error('   Получено:', paramsJson);
    process.exit(1);
  }

  // ─── Инициализация: корень сборки, как у бота ─────────
  // Данные — `data/`; школа — поля TEST_SCHOOL (вызываемым UC школа бота не
  // нужна). U7App выполняет init() (карты UC, подписки ER); start() НЕ
  // вызываем — таймеры job'ов в одноразовом скрипте не нужны.
  const app = new U7App(
    {
      mode: 'development',
      dbDir: 'data',
      communityGroup: TEST_SCHOOL.communityGroup,
      studentGroup: TEST_SCHOOL.studentGroup,
      mentors: [...TEST_SCHOOL.mentors],
    },
    { logger: new ConsoleLogger() },
  );

  // Актор — `Caller` из резолвера приложения (по умолчанию Nur)
  const actorId = actorIdOverride || NUR_UUID;
  const trace = Trace.fromRequest({
    requestId: crypto.randomUUID(),
    channel: { name: 'cli' },
  });
  const caller = await app.callers.resolve(actorId, trace);
  if (caller.kind === 'guest') {
    console.error(`❌ Ошибка: пользователь ${actorId} не найден`);
    process.exit(1);
  }

  // ─── Вызов UseCase ────────────────────────────────
  const dmgUc = findDmgUc(ucName);
  if (!dmgUc) {
    console.error(
      `❌ Ошибка: use case «${ucName}» не найден. Доступные модули: ` +
        DMG_MODULES.map((module) => module.name).join(', '),
    );
    process.exit(1);
  }

  // Вход из командной строки не типизирован — его проверит UC.
  const command = UseCaseDef.commandOf(
    dmgUc.ucDef,
    params as InputOf<AnyUseCaseDef>,
  );
  const res = await app.apiApp.dispatch(
    dmgUc.moduleDef,
    command,
    caller,
    trace,
  );
  if (!res.ok) {
    const { code, label, payload } = res.error;
    console.error(`❌ ${code}: ${label}`, payload ?? '');
    process.exit(1);
  }
  console.log(JSON.stringify(res.value, null, 2));
}

main();
