/** Проверка окружения до дорогой сборки; те же схемы, что у приложения. */
import nextEnv from '@next/env';

// Тот же порядок .env.production.local / .env.local / .env.production / .env,
// что у next build. Переменные панели хостинга имеют приоритет над файлами.
nextEnv.loadEnvConfig(process.cwd(), false);

try {
  const { getServerEnv } = await import('../src/config/env');
  getServerEnv();
  console.log('[build-env] Публичное и серверное окружение валидно.');
} catch (error) {
  console.error(error instanceof Error ? error.message : '[build-env] Ошибка проверки окружения.');
  console.error(
    '[build-env] Добавьте обязательные переменные в Build environment хостинга, ' +
      'а DATABASE_URL и AUTH_SECRET также в runtime. Каталог читается из БД при сборке. ' +
      'Инструкция: docs/launch/node-deployment.md',
  );
  process.exitCode = 1;
}
