/**
 * СГЕНЕРИРОВАННЫЙ ФАЙЛ. Не редактировать руками.
 *
 * Источник: `npm run media:optimize` (scripts/optimize-media.ts).
 * Содержит фактические параметры оптимизированных ассетов из
 * `public/media/seed`: имя файла, реальные размеры, вес и blur-плейсхолдер.
 *
 * Нужен потому, что расширение файла меняется при оптимизации, а размеры
 * обязательны для `next/image`: без них браузер не может зарезервировать
 * место, и вёрстка прыгает при загрузке.
 */

export interface SeedMediaEntry {
  /** Имя файла в `public/media/seed`. */
  file: string;
  width: number;
  height: number;
  bytes: number;
  /**
   * Отпечаток содержимого. Подставляется в URL как `?v=…`.
   *
   * Имя файла производно от семантического имени и при замене содержимого не
   * меняется — а по URL кешируют браузер, CDN и оптимизатор изображений Next.
   * Без отпечатка заменённый ассет продолжает отдаваться прежним.
   */
  fingerprint: string;
  /** Инлайновый плейсхолдер, сгенерированный конвейером. */
  blurDataUrl: string;
}

export const seedMedia = {
  'class-latin-fusion-cover': {
    file: 'class-latin-fusion-cover.f4fca815.webp',
    width: 1376,
    height: 768,
    bytes: 63980,
    fingerprint: 'f4fca815',
    blurDataUrl:
      'data:image/webp;base64,UklGRk4AAABXRUJQVlA4IEIAAADwAQCdASoMAAcAAwBSJYgCdAD0t81XVuAA/vlM4OM8U4UoyCRBzOFw66qzm64+TTaa/+QcN5oQQcWalgmXvBOAAAA=',
  },
  'editorial-loop-poster': {
    file: 'editorial-loop-poster.0b14ccd0.webp',
    width: 1280,
    height: 720,
    bytes: 20914,
    fingerprint: '0b14ccd0',
    blurDataUrl:
      'data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoMAAcAAwBSJQBOgBulqOqr3AD++ftoJ9LvRRwzSxZ/vYG6LNJOhfhAAAA=',
  },
  'editorial-rhythm': {
    file: 'editorial-rhythm.8049c5ea.webp',
    width: 1376,
    height: 768,
    bytes: 38450,
    fingerprint: '8049c5ea',
    blurDataUrl:
      'data:image/webp;base64,UklGRlgAAABXRUJQVlA4IEwAAADwAQCdASoMAAcAAwBSJZACdADdZP6rooAA/vgqBPbPmT1Ptju1Zc++9ALI+0nSbh6dxR4WH0fyW7+P2RFtFko3ZVDZ8TZuDW1AJQAA',
  },
  'hero-dancer': {
    file: 'hero-dancer.0a566d95.webp',
    width: 2752,
    height: 1536,
    bytes: 68474,
    fingerprint: '0a566d95',
    blurDataUrl:
      'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoMAAcAAwBSJZwC7ADp9GvssQAA/vplO8TFyX77+gIgM17ARGU4qymbPtZVcAAA',
  },
  'hero-loop-poster': {
    file: 'hero-loop-poster.f3395db5.webp',
    width: 1920,
    height: 1080,
    bytes: 28232,
    fingerprint: 'f3395db5',
    blurDataUrl:
      'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADQAQCdASoMAAcAAwBSJZwCw7DdJAQaiAD++mU7xMDKp6/pPU4lOoqotmquwBNFhMLkAAAA',
  },
  'instructor-anna-mkrtchyan': {
    file: 'instructor-anna-mkrtchyan.9c857022.webp',
    width: 1024,
    height: 1024,
    bytes: 38002,
    fingerprint: '9c857022',
    blurDataUrl:
      'data:image/webp;base64,UklGRnoAAABXRUJQVlA4IG4AAAAwAgCdASoMAAwAAwBSJbACdAYq/a+aPLfWAAD+1zbYYGYveJFxyEoTHZ6iQf9aOPUBWWGvJdcGPyaAw/UiuNZvP4eJhhwUWaSXLeBElWvRuygPrfBtfH9P1fCEP9uyIek4gtlLe0EzJ5WV5cMAAA==',
  },
  'instructor-arman-harutyunyan': {
    file: 'instructor-arman-harutyunyan.d8c9f723.webp',
    width: 1024,
    height: 1024,
    bytes: 95520,
    fingerprint: 'd8c9f723',
    blurDataUrl:
      'data:image/webp;base64,UklGRmgAAABXRUJQVlA4IFwAAAAQAgCdASoMAAwAAwBSJbACdAD0Flgos+IAAPv/Fa5sgH3R1D2YDOsHtPYMn1nbwbycXXJ6WTooWyW/Hln36Cfe3VyX4OR49IAuW+xG08jb0GrL2Mqii1FbBgAAAA==',
  },
  'instructor-nare-grigoryan': {
    file: 'instructor-nare-grigoryan.a3abb381.webp',
    width: 765,
    height: 1024,
    bytes: 31208,
    fingerprint: 'a3abb381',
    blurDataUrl:
      'data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAADQAQCdASoMABAAAwBSJYgCdADZdVfBgAD+kXuj6OIAhf2QoVIU6tGRT9UDXj7KuGlNtCD5D/isP/KlgYi3z7lRcj4Z4cE8jVMOB+Z9vyhG2tYYTByIm+jvAAA=',
  },
  'product-dance-bag': {
    file: 'product-dance-bag.f332ff31.webp',
    width: 765,
    height: 1024,
    bytes: 38248,
    fingerprint: 'f332ff31',
    blurDataUrl:
      'data:image/webp;base64,UklGRmwAAABXRUJQVlA4IGAAAAAQAgCdASoMABAAAwBSJbACdAEVX43DSJ4AAP7uVkHOlZcd0dyo/SQM1Gr0oeouAVwKxx9E616zEVL5PPXkynfpjxpi/4Bn2MoKvvz1x3V+C6uxaZERZH//gcYsLb/gAAA=',
  },
  'product-dance-shoes': {
    file: 'product-dance-shoes.5b764624.webp',
    width: 765,
    height: 1024,
    bytes: 63896,
    fingerprint: '5b764624',
    blurDataUrl:
      'data:image/webp;base64,UklGRnQAAABXRUJQVlA4IGgAAAAwAgCdASoMABAAAwBSJQBOgMX6qBrB88+FUADOP/HB547GIE6cO+JUKzm0QhcduNby4PUgyHpAo4942wI3UyVuKg+hZfqR2wAB73IBZVP2sU+li+P5jeDpyLZ68voITuKNdgRElGdwAA==',
  },
  'product-gift-card': {
    file: 'product-gift-card.96e23c03.webp',
    width: 765,
    height: 1024,
    bytes: 69760,
    fingerprint: '96e23c03',
    blurDataUrl:
      'data:image/webp;base64,UklGRmQAAABXRUJQVlA4IFgAAAAQAgCdASoMABAAAwBSJZACdAELMRFLYaQAAP6sZSFVRh18/TtpCgvIIaYmhMffQme6qXtQ8UAQpJJmae8J15zlTIlxvYK2+xJz32gviFAm7ujrLyicAAAA',
  },
  'product-training-apparel': {
    file: 'product-training-apparel.847dbe44.webp',
    width: 765,
    height: 1024,
    bytes: 58920,
    fingerprint: '847dbe44',
    blurDataUrl:
      'data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAAAwAgCdASoMABAAAwBSJZwAD4/Qb1q9TudAAAD+8GqdTmXH7JTFgGJ8+pkIK7nnH0gckTHofKfAM9TWl/317zvhTVfekdVdG7iuwrxw43KVUf3q/yq1rwtbgAA=',
  },
  'studio-flow-studio': {
    file: 'studio-flow-studio.1b4e039a.webp',
    width: 1024,
    height: 572,
    bytes: 75478,
    fingerprint: '1b4e039a',
    blurDataUrl:
      'data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAADwAQCdASoMAAcAAwBSJZgCdAEDfY0HfkgA+fOvql4jSkUgj3fHKazz7crWsBGF34t8W41syAhQFZsQK62G+oxgpAdbUHKYAAA=',
  },
  'studio-pulse-dance-studio': {
    file: 'studio-pulse-dance-studio.bac37556.webp',
    width: 1024,
    height: 572,
    bytes: 74178,
    fingerprint: 'bac37556',
    blurDataUrl:
      'data:image/webp;base64,UklGRl4AAABXRUJQVlA4IFIAAAAQAgCdASoMAAcAAwBSJagCdAELZao4Ly4AAP6VD7NMhZIsp/vbjZSmEcXTzZV2K/TKaZbKg7c4g1GOWAdYmIen0icFK2oTn6iHw7dVJq4gAAAA',
  },
  'studio-rhythm-space': {
    file: 'studio-rhythm-space.bdb34110.webp',
    width: 1024,
    height: 572,
    bytes: 49606,
    fingerprint: 'bdb34110',
    blurDataUrl:
      'data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAADwAQCdASoMAAcAAwBSJQBOgBuw8quyeAAA/kE35MezEvKxLgtBJFr0+Vr/AS7V43TLUlIF6RsTtd7Iq8NUhFLZFEtsQSiMcAA=',
  },
  'style-ballet': {
    file: 'style-ballet.a3abb381.webp',
    width: 765,
    height: 1024,
    bytes: 31208,
    fingerprint: 'a3abb381',
    blurDataUrl:
      'data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAADQAQCdASoMABAAAwBSJYgCdADZdVfBgAD+kXuj6OIAhf2QoVIU6tGRT9UDXj7KuGlNtCD5D/isP/KlgYi3z7lRcj4Z4cE8jVMOB+Z9vyhG2tYYTByIm+jvAAA=',
  },
  'style-contemporary': {
    file: 'style-contemporary.6c64c3ed.webp',
    width: 1024,
    height: 572,
    bytes: 20708,
    fingerprint: '6c64c3ed',
    blurDataUrl:
      'data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoMAAcAAwBSJQBOgCFsFOZLAAD+99zAJPVbGkIfit7CSTvrdBWCwHfHeAA=',
  },
  'style-heels': {
    file: 'style-heels.597acd43.webp',
    width: 765,
    height: 1024,
    bytes: 39034,
    fingerprint: '597acd43',
    blurDataUrl:
      'data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAABQAgCdASoMABAAAwBSJYwCw7YqD2tjrdyC34AA/ubYmnPyJaMw1pU2Xs3fsqt0KOyoAEG2vEXjOWz+fDsKIpoOgme68e5I5koLwY0050D/RYjbdxXXlmMAAAA=',
  },
  'style-hip-hop': {
    file: 'style-hip-hop.048f58d7.webp',
    width: 765,
    height: 1024,
    bytes: 93488,
    fingerprint: '048f58d7',
    blurDataUrl:
      'data:image/webp;base64,UklGRmoAAABXRUJQVlA4IF4AAAAwAgCdASoMABAAAwBSJZACdAEfhiHrTt4BAAD+97GlPBKOyuH9gNxez6tPh/uBUktnUFq26YtfD44vWNgApwt14KZNXTmaEwk+oy1msUByiks1gowCdHF27qplwwAA',
  },
  'style-salsa': {
    file: 'style-salsa.ba306342.webp',
    width: 765,
    height: 1024,
    bytes: 51178,
    fingerprint: 'ba306342',
    blurDataUrl:
      'data:image/webp;base64,UklGRngAAABXRUJQVlA4IGwAAAAQAgCdASoMABAAAwBSJaACdAEQ+mQNDyAYAP71m0BM1N5lr7ErabKje2ImE6lpk3WVR2rE3OqOjDtveAaq9wn8qqq6su7Ml/iSh3zLEpxL1YJbi9H0su7sjIhzbx4RvIi02uY87cmbJAkgAAA=',
  },
} as const satisfies Record<string, SeedMediaEntry>;

export type SeedMediaName = keyof typeof seedMedia;

/** Суммарный вес папки сид-медиа, байт. Сверяется с `mediaProcessing.budgetBytes.seedTotal`. */
export const seedMediaTotalBytes = 1050482;
