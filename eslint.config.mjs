import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Правила, которые машинно обеспечивают договорённость «никаких абсолютных
 * значений и текстов в коде». Без них конвенция держится на дисциплине,
 * а с ними — на CI.
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'next-env.d.ts',
    ],
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      /* Чтение окружения — только через config/env.ts. */
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Используйте clientEnv / getServerEnv() из @/config/env.',
        },
      ],

      /* Навигация — только локале-зависимая, иначе теряется префикс языка. */
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message: 'Импортируйте Link из @/i18n/routing.',
            },
            {
              name: '@/design/tokens/primitives',
              message:
                'Компоненты не импортируют primitives. Используйте семантические токены или Tailwind-утилиты.',
            },
          ],
        },
      ],

      /* Запрет literal-цветов и путей-строк. */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}){1,2}$/]',
          message: 'HEX-цвет в коде. Значение должно быть в src/design/tokens/primitives.ts.',
        },
        {
          selector: 'Literal[value=/^(rgb|hsl)a?\\(/]',
          message: 'Цвет в коде. Значение должно быть в src/design/tokens/primitives.ts.',
        },
        {
          selector: "JSXAttribute[name.name='href'] > Literal[value=/^\\//]",
          message: 'Путь-литерал. Используйте routes.* из @/config.',
        },
      ],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  /* Слой конфигурации — единственное место, где литералы легальны. */
  {
    files: [
      'src/config/**/*.ts',
      'src/design/tokens/**/*.ts',
      'src/i18n/**/*.ts',
      'src/domain/enums.ts',
      'src/proxy.ts',
      'scripts/**/*.ts',
      'next.config.ts',
      'prisma/**/*.ts',
    ],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
    },
  },

  /**
   * Edge-совместимые модули безопасности. `proxy.ts` работает в Edge-рантайме,
   * где Zod-схема серверного окружения недоступна, поэтому эти два модуля читают
   * `process.env` напрямую. Все переменные необязательные — их отсутствие
   * означает работу без Redis / без CAPTCHA, а не падение.
   */
  {
    files: ['src/lib/security/rate-limit.ts', 'src/lib/security/turnstile.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },

  /**
   * `global-error.tsx` — последний рубеж: корневой layout уже упал. Здесь
   * недоступны провайдер переводов, Tailwind-цепочка и роутер, поэтому
   * инлайновые цвета, текст в разметке, обычный `<a>` и прямое чтение
   * `process.env` — единственный работающий вариант. Это осознанное исключение,
   * а не недоработка: см. комментарий в самом файле.
   */
  {
    files: ['src/app/global-error.tsx'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];

export default config;
