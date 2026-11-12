import type { AppMode } from 'dmg-core/app';
import * as v from 'valibot';

/**
 * Схема валидации конфигурации бота.
 * Bun загружает .env автоматически — dotenv не требуется.
 */
export const BotConfigSchema = v.object({
  botToken: v.pipe(v.string(), v.nonEmpty('BOT_TOKEN не может быть пустым')),
  communityGroupUrl: v.pipe(
    v.string(),
    v.nonEmpty('COMMUNITY_GROUP_URL не может быть пустым'),
  ),
  communityGroupId: v.pipe(
    v.number(),
    v.integer('COMMUNITY_GROUP_ID должен быть целым числом'),
  ),
  studentGroupId: v.pipe(
    v.number(),
    v.integer('STUDENT_GROUP_ID должен быть целым числом'),
  ),
  studentGroupInvite: v.pipe(
    v.string(),
    v.nonEmpty('STUDENT_GROUP_INVITE не может быть пустым'),
  ),
  mode: v.picklist(
    ['test', 'development', 'production'] as const satisfies readonly AppMode[],
    'NODE_ENV должен быть test, development или production',
  ),
  botAdminUuid: v.pipe(
    v.string(),
    v.uuid('BOT_ADMIN_UUID должен быть валидным UUID'),
  ),
  dbDir: v.optional(
    v.pipe(v.string(), v.nonEmpty('DB_DIR не может быть пустым')),
    './data',
  ),

  // ══ Режим бота ══
  botMode: v.optional(v.picklist(['polling', 'webhook']), 'polling'),

  // ══ Dev-режим: подмена личности (см. infra/dev-persona.ts) ══
  // Только для локальной разработки: апдейты с этого telegramId
  // получают личность фикстурной персоны (переключение /persona).
  devTelegramId: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),

  // ══ Webhook (только если botMode = 'webhook') ══
  webhookUrl: v.optional(v.string()),
  webhookPort: v.optional(
    v.pipe(v.number(), v.minValue(1), v.maxValue(65535)),
    8443,
  ),
  webhookPath: v.optional(v.pipe(v.string(), v.nonEmpty()), '/webhook'),

  // ══ Токен для TelegramLogger (отдельный бот, чтобы не пересекался с основным) ══
  loggerBotToken: v.optional(v.string(), ''),

  // ══ Администраторы для уведомлений ══
  adminTelegramIds: v.optional(
    v.pipe(
      v.string(),
      v.transform((input) =>
        input
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => Number(s))
          .filter((n) => !Number.isNaN(n)),
      ),
    ),
    '',
  ),

  // ══ Менторы школы (опциональный список UUID через запятую, например для dev-режима) ══
  schoolMentors: v.optional(
    v.pipe(
      v.string(),
      v.transform((input) =>
        input
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
      v.array(
        v.pipe(v.string(), v.uuid('Некорректный формат UUID ментора школы')),
      ),
    ),
  ),
});

export type BotConfig = v.InferOutput<typeof BotConfigSchema>;

/** Переменные окружения процесса — их читает точка входа раннера (ARC-09). */
export type BotEnv = Readonly<Record<string, string | undefined>>;

/**
 * Валидирует конфигурацию из переменных окружения `env`: `main.ts` передаёт
 * `process.env` (ARC-09). Bun загружает .env автоматически — dotenv не требуется.
 */
export function loadConfig(env: BotEnv): BotConfig {
  const raw = {
    botToken: env.BOT_TOKEN,
    communityGroupUrl: env.COMMUNITY_GROUP_URL,
    communityGroupId: env.COMMUNITY_GROUP_ID
      ? Number(env.COMMUNITY_GROUP_ID)
      : undefined,
    studentGroupId: env.STUDENT_GROUP_ID
      ? Number(env.STUDENT_GROUP_ID)
      : undefined,
    studentGroupInvite: env.STUDENT_GROUP_INVITE,
    mode: env.NODE_ENV,
    botAdminUuid: env.BOT_ADMIN_UUID,
    botMode: env.BOT_MODE,
    webhookUrl: env.WEBHOOK_URL,
    webhookPort: env.WEBHOOK_PORT ? Number(env.WEBHOOK_PORT) : undefined,
    webhookPath: env.WEBHOOK_PATH,
    adminTelegramIds: env.ADMIN_TELEGRAM_IDS,
    loggerBotToken: env.LOGGER_BOT_TOKEN,
    dbDir: env.DB_DIR,
    devTelegramId: env.DEV_TELEGRAM_ID
      ? Number(env.DEV_TELEGRAM_ID)
      : undefined,
    schoolMentors: env.SCHOOL_MENTOR_IDS,
  };

  return v.parse(BotConfigSchema, raw);
}
