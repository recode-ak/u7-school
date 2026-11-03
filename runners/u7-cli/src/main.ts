import { U7App } from '@u7-scl/app';
import { TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import { ConsoleLogger, LogLevel } from '@u7-scl/core/shared';
import { CliController } from './cli-controller';

async function main() {
  const logger = new ConsoleLogger();
  logger.setLogLevel(LogLevel.DEBUG);

  // CLI не стартует без about.md у всех legacy-модулей; только legacy-UC.
  // Корень сборки (D-50): данные — `data/` (прежние пути по умолчанию),
  // школа — поля TEST_SCHOOL. CLI — короткоживущий процесс: U7App
  // инициализирует планировщик (обязательный контракт ApiApp), но start()
  // не вызывается — фоновые задания не нужны.
  const app = new U7App(
    {
      mode: 'development',
      dbDir: 'data',
      communityGroup: TEST_SCHOOL.communityGroup,
      studentGroup: TEST_SCHOOL.studentGroup,
      mentors: [...TEST_SCHOOL.mentors],
    },
    { logger },
  );
  const controller = new CliController(app.apiApp);
  await controller.run();
}

main().catch(console.error);
