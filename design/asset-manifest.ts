/**
 * МАНИФЕСТ АССЕТОВ ПРОТОТИПА.
 *
 * Единственный источник соответствия «файл дизайна → сущность в продукте».
 * Нужен потому, что в утверждённом прототипе изображения названы UUID'ами
 * (`01a8724c-2a8f-4949-b140-afd241b012b8.png`), и без этой таблицы понять, что
 * на картинке, можно только открыв её.
 *
 * Используется:
 *   • `npm run design:import` — копирует и переименовывает файлы в `public/media/seed`;
 *   • `prisma/fixtures/demo.ts` — сид ссылается на семантические имена;
 *   • ревью — видно, какие изображения в прототипе переиспользованы как заглушки.
 *
 * Источник: `design/reference/artdance-final.html` (версия из `artdance-deploy`,
 * 1 сентября 2026).
 */

import type { ImagePresetKey } from '../src/config/media';
import { seedMedia as generatedSeedMedia, type SeedMediaEntry } from './seed-media.generated';

export interface DesignAsset {
  /** Семантическое имя в `public/media/seed`. Без расширения. */
  name: string;
  /** Имя файла в исходной папке прототипа. */
  source: string;
  /** Роль изображения → определяет `sizes`, `quality`, `priority`. */
  preset: ImagePresetKey;
  /** Что на изображении — для alt-текста и для понимания без открытия файла. */
  subject: string;
  /**
   * Где использовано в прототипе. Пометка `placeholder` означает, что в дизайне
   * изображение переиспользовано не по назначению (например, фото инструктора
   * стоит в отзыве) — при наполнении контентом нужен свой файл.
   */
  usedFor: ReadonlyArray<{ entity: string; id: string; placeholder?: true }>;
  /** Требует пережатия перед production: PNG-фотография или > 500 KB. */
  needsOptimization?: true;
}

export const designAssets: readonly DesignAsset[] = [
  {
    name: 'hero-dancer',
    source: '01a8724c-2a8f-4949-b140-afd241b012b8.png',
    preset: 'heroFullBleed',
    subject: 'Танцовщица в движении, контровой свет — главный кадр первого экрана',
    usedFor: [{ entity: 'page', id: 'home.hero' }],
    // 1,9 MB PNG на LCP-элементе. Обязательно AVIF/WebP до запуска.
    needsOptimization: true,
  },
  {
    name: 'editorial-rhythm',
    source: '5eab5a05-f148-4e4c-91bf-688a65cf53bc.png',
    preset: 'editorialFullBleed',
    subject: 'Кинематографичный кадр для editorial-секции «Every body has a rhythm»',
    usedFor: [
      { entity: 'page', id: 'home.editorial' },
      { entity: 'event', id: 'bachata-night-workshop', placeholder: true },
    ],
    needsOptimization: true,
  },

  /* Направления танца */
  {
    name: 'style-hip-hop',
    source: '23bdec28-c439-479f-ad23-d19debdac9e7.png',
    preset: 'categoryCard',
    subject: 'Хип-хоп: уличная динамика',
    usedFor: [
      { entity: 'danceStyle', id: 'HIP_HOP' },
      { entity: 'class', id: 'street-flow' },
      { entity: 'instructor', id: 'david-sargsyan', placeholder: true },
      { entity: 'event', id: 'yerevan-street-battle', placeholder: true },
    ],
  },
  {
    name: 'style-ballet',
    source: '377aa17c-8217-4aee-8874-831ab6ecb04a.png',
    preset: 'categoryCard',
    subject: 'Балет: классическая линия',
    usedFor: [
      { entity: 'danceStyle', id: 'BALLET' },
      { entity: 'class', id: 'classical-ballet-intensive' },
    ],
  },
  {
    name: 'style-salsa',
    source: '5c2a57f4-b8e2-440d-bfb2-09359d2411ab.png',
    preset: 'categoryCard',
    subject: 'Сальса: парное движение',
    usedFor: [
      { entity: 'danceStyle', id: 'SALSA' },
      { entity: 'class', id: 'latin-fusion' },
    ],
  },
  {
    name: 'style-contemporary',
    source: '6aeafcb1-3d7c-4e52-8100-ee646104e531.png',
    preset: 'categoryCard',
    subject: 'Контемпорари: пластика и линия',
    usedFor: [
      { entity: 'danceStyle', id: 'CONTEMPORARY' },
      { entity: 'class', id: 'contemporary-flow' },
      { entity: 'event', id: 'contemporary-masterclass', placeholder: true },
    ],
  },
  {
    name: 'style-heels',
    source: '955d573b-63a2-49ef-9a0c-0eb3abe212fe.png',
    preset: 'categoryCard',
    subject: 'Heels: каблуки, силуэт',
    usedFor: [{ entity: 'danceStyle', id: 'HEELS' }],
  },

  /* Инструкторы */
  {
    name: 'instructor-anna-mkrtchyan',
    source: 'c976391d-3a63-4193-acd5-82872d310bca.png',
    preset: 'instructorCard',
    subject: 'Портрет инструктора: Анна Мкртчян',
    usedFor: [
      { entity: 'instructor', id: 'anna-mkrtchyan' },
      { entity: 'review', id: 'mariam-ghazaryan', placeholder: true },
    ],
  },
  {
    name: 'instructor-arman-harutyunyan',
    source: 'a3edf9e0-794b-455e-8815-fc1f9f75107a.png',
    preset: 'instructorCard',
    subject: 'Портрет инструктора: Арман Арутюнян',
    usedFor: [{ entity: 'instructor', id: 'arman-harutyunyan' }],
  },
  {
    name: 'instructor-nare-grigoryan',
    source: 'bd5b4c2f-144f-4360-ac84-b401b07d9636.png',
    preset: 'instructorCard',
    subject: 'Портрет инструктора: Наре Григорян',
    usedFor: [{ entity: 'instructor', id: 'nare-grigoryan' }],
  },

  /* Площадки */
  {
    name: 'studio-pulse-dance-studio',
    source:
      'nano-banana-2_Group_dance_class_in_a_premium_studio_diverse_dancers_in_synchronized_movement_w-0.jpg',
    preset: 'studioCard',
    subject: 'Групповое занятие в зале с зеркалами — Pulse Dance Studio',
    usedFor: [{ entity: 'venue', id: 'pulse-dance-studio' }],
  },
  {
    name: 'studio-rhythm-space',
    source: 'ChatGPT Image Aug 31, 2026, 07_11_59 PM.png',
    preset: 'studioCard',
    subject: 'Зал с оборудованием — Rhythm Space',
    usedFor: [
      { entity: 'venue', id: 'rhythm-space' },
      { entity: 'review', id: 'narine-hovhannisyan', placeholder: true },
    ],
  },
  {
    name: 'studio-flow-studio',
    source: 'ee53e9da-8fec-4d03-abd9-01d883646372.png',
    preset: 'studioCard',
    subject: 'Зал с деревянным полом и станком — Flow Studio',
    usedFor: [{ entity: 'venue', id: 'flow-studio' }],
  },

  /* Товары */
  {
    name: 'product-dance-bag',
    source:
      'nano-banana-2_A_sleek_black_premium_dance_duffel_bag_with_subtle_gold_accents_placed_on_polish-0_14b96210-8d53-484b-978b-d66a022dfee8.jpg',
    preset: 'productCard',
    subject: 'Чёрная сумка с золотыми акцентами',
    usedFor: [{ entity: 'product', id: 'premium-dance-bag' }],
  },
  {
    name: 'product-dance-shoes',
    source:
      'nano-banana-2_An_artistic_arrangement_of_professional_dance_shoes___Latin_heels_ballet_slipp-0_bfd55e87-c36e-40a1-baae-68c6aab08f63.jpg',
    preset: 'productCard',
    subject: 'Композиция из танцевальной обуви',
    usedFor: [
      { entity: 'product', id: 'dance-shoes-collection' },
      { entity: 'review', id: 'arman-harutyunyan', placeholder: true },
    ],
  },
  {
    name: 'product-training-apparel',
    source:
      'nano-banana-2_A_neatly_folded_set_of_premium_dance_training_clothes___black_leggings_fitted_-0_1d9c5b91-b6b5-40f8-b2f6-21e77732d82c.jpg',
    preset: 'productCard',
    subject: 'Комплект тренировочной одежды',
    usedFor: [{ entity: 'product', id: 'training-apparel-set' }],
  },
  {
    name: 'product-gift-card',
    source:
      'nano-banana-2_An_elegant_burgundy_and_gold_gift_card_with_a_subtle_embossed_dance_figure_motif-0_15649766-2675-4c53-b115-05ab4ce79cb7.jpg',
    preset: 'productCard',
    subject: 'Подарочная карта в бургунди с золотом',
    usedFor: [{ entity: 'product', id: 'gift-card' }],
  },

  /* Занятие */
  {
    name: 'class-latin-fusion-cover',
    source:
      'nano-banana-2_A_professional_editorial_photograph_of_a_couple_dancing_bachata_in_an_intimate_d-0_0c5a9b8c-7c03-49be-aa3e-4ce0fae9186b.jpg',
    preset: 'editorialFullBleed',
    subject: 'Пара танцует бачату — обложка страницы занятия',
    usedFor: [{ entity: 'class', id: 'latin-fusion' }],
  },
];

/**
 * Файлы, лежащие в папке прототипа, но НЕ используемые разметкой.
 * Зафиксированы, чтобы их не переносили «на всякий случай» и не искали,
 * куда они должны встать.
 */
export const unusedSourceFiles: ReadonlyArray<{ file: string; reason: string }> = [
  {
    file: '1cda1a7c-58aa-4c13-8061-e74553a02aeb.png',
    reason: 'побайтовая копия 23bdec28… (style-hip-hop)',
  },
  {
    file: '5c2a57f4-b8e2-440d-bfb2-09359d24113ab.png',
    reason: 'опечатка в имени (лишняя «3»), вариант style-salsa на 1,2 MB; разметка ссылается на другой файл',
  },
  {
    file: 'ee53e9da-8fec-4d03-ab5d9-01d883646372.png',
    reason: 'опечатка в имени (ab5d9 вместо abd9), вариант studio-flow-studio на 1,25 MB',
  },
];

/** Быстрый доступ по семантическому имени. */
export const assetByName = new Map(designAssets.map((asset) => [asset.name, asset]));

/**
 * Параметры файла после оптимизации: путь, реальные размеры и blur-плейсхолдер.
 *
 * Расширение не передаётся параметром намеренно: после `npm run media:optimize`
 * все ассеты лежат в WebP, и знание расширения не должно расползаться по коду.
 * Источник — сгенерированный манифест, поэтому размеры всегда соответствуют
 * файлу на диске: `next/image` получает точные `width`/`height` и не даёт
 * скачка вёрстки.
 */
export function seedMedia(name: string): (SeedMediaEntry & { src: string }) | undefined {
  const entry = generatedSeedMedia[name as keyof typeof generatedSeedMedia];
  if (!entry) return undefined;
  return { ...entry, src: `/media/seed/${entry.file}` };
}

/** Путь к оптимизированному файлу ассета. Пустая строка, если ассета нет. */
export function seedMediaPath(name: string): string {
  return seedMedia(name)?.src ?? '';
}
