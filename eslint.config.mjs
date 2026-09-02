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
              message: 'Импортируйте Link из @/i18n/routing — иначе теряется префикс локали.',
            },
            {
              name: 'next/image',
              message:
                'Прямой next/image запрещён. Используйте <Media preset="…"> из @/components/ui/media: ' +
                'рассинхрон sizes и сетки — главная причина проваленного LCP.',
            },
            {
              name: 'next/navigation',
              importNames: ['redirect', 'permanentRedirect', 'useRouter', 'usePathname'],
              message:
                'Эти API теряют локаль. Импортируйте их из @/i18n/routing.',
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
        {
          selector: "JSXOpeningElement[name.name='video']",
          message:
            'Тег <video> напрямую запрещён: нужны постер, подавление автозапуска при ' +
            'reduced-motion/Save-Data и кнопка паузы (WCAG 2.2.2). Используйте компоненты ' +
            'из components/home/hero-video.tsx или components/media/video-player.tsx.',
        },
        {
          selector: "JSXAttribute[name.name='className'] > Literal[value=/\\[(?:[0-9.]+(?:px|rem)|#)/]",
          message:
            'Произвольное значение в Tailwind-классе (arbitrary value). Добавьте токен ' +
            'в src/design/tokens вместо literal-значения в разметке.',
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
   * `Media` — единственный компонент, которому разрешён `next/image`, и
   * `HeroVideo` / `VideoPlayer` — единственные, кому разрешён `<video>`.
   * Исключение объявлено здесь, а не комментарием-отключением в файле: так его
   * видно в одном месте и нельзя размножить копипастой.
   */
  {
    files: [
      'src/components/ui/media.tsx',
      'src/components/home/hero-video.tsx',
      'src/components/media/video-player.tsx',
    ],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      '@next/next/no-img-element': 'off',
    },
  },

  /**
   * Компоненты shadcn/ui копируются в проект как есть и обновляются командой
   * `npx shadcn add --overwrite`. Держать в них наши правки — значит терять их
   * при каждом обновлении, поэтому здесь отключены стилевые ограничения.
   * Брендовые компоненты (Badge, Price, RatingStars) писались отдельно и под
   * общие правила попадают.
   */
  {
    files: ['src/components/ui/{accordion,alert,alert-dialog,aspect-ratio,avatar,breadcrumb,calendar,card,carousel,checkbox,collapsible,command,dialog,drawer,dropdown-menu,form,hover-card,input,input-otp,label,pagination,popover,progress,radio-group,scroll-area,select,separator,sheet,skeleton,slider,sonner,switch,table,tabs,textarea,toggle,toggle-group,tooltip}.tsx'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
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
