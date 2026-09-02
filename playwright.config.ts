/**
 * Конфигурация e2e-проверок.
 *
 * Зачем они здесь, когда есть 116 unit-тестов: unit-тест не может ответить на
 * вопрос «работает ли ловушка фокуса», «закрывается ли меню по Esc», «не
 * накрывает ли фиксированная шапка выпадающий список». Это свойства собранной
 * страницы в настоящем браузере, и проверять их глазами на каждом изменении —
 * значит однажды не проверить.
 *
 * Проверки идут против ПРОДАКШЕН-сборки (`next build` + `next start`), а не
 * против dev-сервера: у dev другой CSS-конвейер, другие лимиты и нет
 * минификации, поэтому «работает в dev» ничего не гарантирует.
 *
 * Три ширины экрана вместо одной: главные дефекты этого макета — именно на
 * границах, где строка ссылок уходит в бургер.
 */

import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

/*
 * Переменные окружения нужны самому тест-процессу, а не только серверу: тесты
 * импортируют слой конфигурации (`business.ts`, `media.ts`), а он валидирует
 * окружение при импорте — и падает раньше, чем начнётся первый тест. В CI файла
 * нет, значения приходят из окружения workflow, и отсутствие файла не ошибка.
 */
loadEnv({ path: '.env.local' });

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  /** Полная изоляция: тест не должен зависеть от порядка запуска. */
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      /** Планшет: ширина, на которой в прототипе ссылки наезжали на кнопки. */
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 900, height: 1000 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
