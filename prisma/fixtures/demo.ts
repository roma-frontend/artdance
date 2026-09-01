/**
 * ДЕМО-ДАННЫЕ ИЗ УТВЕРЖДЁННОГО ПРОТОТИПА.
 *
 * Все имена, цены, длительности, рейтинги и время слотов взяты дословно из
 * `design/reference/artdance-final.html`. Смысл: после `npm run db:seed`
 * локальное приложение выглядит как макет, который видел клиент. Это убирает
 * два источника потерь времени — придумывание тестовых данных и расхождение
 * «в макете было иначе» на приёмке.
 *
 * Правила файла:
 *   • это ЕДИНСТВЕННОЕ место, где допустимы демо-строки на английском: они
 *     соответствуют прототипу и заменяются реальным контентом заказчика;
 *   • цены — целые драмы, как везде в проекте;
 *   • ссылки на изображения — семантические имена из `design/asset-manifest.ts`;
 *   • слаги стабильны: на них ссылается `usedFor` в манифесте ассетов.
 */

import type {
  DanceStyle,
  EventType,
  SkillLevel,
  VenueAmenity,
} from '../../src/domain/enums.ts';

/* ─────────────────────────── Направления ─────────────────────────── */

/** Счётчики занятий из блока «Find Your Way to Dance» прототипа. */
export const demoStyleTiles: ReadonlyArray<{
  style: DanceStyle;
  asset: string;
  classCount: number;
}> = [
  { style: 'HIP_HOP', asset: 'style-hip-hop', classCount: 48 },
  { style: 'BALLET', asset: 'style-ballet', classCount: 24 },
  { style: 'SALSA', asset: 'style-salsa', classCount: 32 },
  { style: 'CONTEMPORARY', asset: 'style-contemporary', classCount: 18 },
  { style: 'HEELS', asset: 'style-heels', classCount: 15 },
];

/* ─────────────────────────── Инструкторы ─────────────────────────── */

export interface DemoInstructor {
  slug: string;
  name: string;
  email: string;
  asset: string;
  headline: string;
  bio: string;
  styles: readonly DanceStyle[];
  specializations: readonly string[];
  yearsExperience: number;
  hourlyRateFrom: number;
  ratingAverage: number;
  ratingCount: number;
  studentCount: number;
  isVerified: boolean;
  acceptsTravel: boolean;
  experience?: ReadonlyArray<{
    title: string;
    organization?: string;
    location?: string;
    startYear: number;
    endYear?: number;
  }>;
}

export const demoInstructors: readonly DemoInstructor[] = [
  {
    slug: 'anna-mkrtchyan',
    name: 'Anna Mkrtchyan',
    email: 'anna.mkrtchyan@demo.artdance.am',
    asset: 'instructor-anna-mkrtchyan',
    headline: 'Salsa · Latin · Bachata',
    bio:
      "Anna is one of Yerevan's most sought-after Latin dance instructors. With 8 years of " +
      'teaching experience and performance credits across Europe, she brings infectious energy ' +
      'and deep technical knowledge to every class.',
    styles: ['SALSA', 'LATIN', 'BACHATA'],
    specializations: ['Salsa On1', 'Bachata Sensual', 'Cha-Cha', 'Body Movement'],
    yearsExperience: 8,
    hourlyRateFrom: 15_000,
    ratingAverage: 4.9,
    ratingCount: 128,
    studentCount: 320,
    isVerified: true,
    acceptsTravel: true,
    experience: [
      {
        title: 'Lead Instructor',
        organization: 'Pulse Dance Studio',
        location: 'Yerevan',
        startYear: 2022,
      },
      { title: 'Guest Instructor', organization: 'Dance Congress', startYear: 2019, endYear: 2022 },
      { title: 'Competitive Dancer', location: 'Armenia + Europe', startYear: 2016, endYear: 2019 },
    ],
  },
  {
    slug: 'arman-harutyunyan',
    name: 'Arman Harutyunyan',
    email: 'arman.harutyunyan@demo.artdance.am',
    asset: 'instructor-arman-harutyunyan',
    headline: 'Hip-Hop · Choreography',
    bio: 'Street-trained choreographer working with Yerevan crews and commercial projects.',
    styles: ['HIP_HOP', 'BREAKING'],
    specializations: ['Hip-Hop Foundations', 'Choreography', 'Freestyle'],
    yearsExperience: 7,
    hourlyRateFrom: 12_000,
    ratingAverage: 4.8,
    ratingCount: 96,
    studentCount: 280,
    isVerified: true,
    acceptsTravel: true,
  },
  {
    slug: 'nare-grigoryan',
    name: 'Nare Grigoryan',
    email: 'nare.grigoryan@demo.artdance.am',
    asset: 'instructor-nare-grigoryan',
    headline: 'Contemporary · Modern',
    bio: 'Contemporary dancer and teacher focused on floor work, breath and musicality.',
    styles: ['CONTEMPORARY', 'JAZZ'],
    specializations: ['Floor Work', 'Improvisation', 'Partnering'],
    yearsExperience: 9,
    hourlyRateFrom: 18_000,
    ratingAverage: 5,
    ratingCount: 64,
    studentCount: 180,
    isVerified: true,
    acceptsTravel: false,
  },
  {
    slug: 'david-sargsyan',
    name: 'David Sargsyan',
    email: 'david.sargsyan@demo.artdance.am',
    /** В прототипе портрета нет — переиспользован кадр направления. */
    asset: 'style-hip-hop',
    headline: 'Ballet · Classical',
    bio: 'Classically trained ballet teacher with a decade of stage experience.',
    styles: ['BALLET'],
    specializations: ['Classical Technique', 'Pointe', 'Stretching'],
    yearsExperience: 12,
    hourlyRateFrom: 20_000,
    ratingAverage: 4.9,
    ratingCount: 152,
    studentCount: 450,
    isVerified: true,
    acceptsTravel: false,
  },
  {
    slug: 'sona-hovhannisyan',
    name: 'Sona Hovhannisyan',
    email: 'sona.hovhannisyan@demo.artdance.am',
    asset: 'style-ballet',
    headline: 'Ballet · Repertoire',
    bio: 'Ballet repertoire and intensive programmes for advanced students.',
    styles: ['BALLET'],
    specializations: ['Repertoire', 'Variations'],
    yearsExperience: 15,
    hourlyRateFrom: 22_000,
    ratingAverage: 4.9,
    ratingCount: 88,
    studentCount: 260,
    isVerified: true,
    acceptsTravel: false,
  },
];

/* ─────────────────────────── Площадки ─────────────────────────── */

export interface DemoVenue {
  slug: string;
  name: string;
  description: string;
  district: string;
  asset: string;
  amenities: readonly VenueAmenity[];
  pricePerHour: number;
  ratingAverage: number;
  ratingCount: number;
  areaSqm: number;
  capacity: number;
  latitude: number;
  longitude: number;
}

export const demoVenues: readonly DemoVenue[] = [
  {
    slug: 'pulse-dance-studio',
    name: 'Pulse Dance Studio',
    description: 'Central studio with mirrors, professional sound and sprung floor.',
    district: 'Kentron',
    asset: 'studio-pulse-dance-studio',
    amenities: ['MIRRORS', 'SOUND_SYSTEM', 'SPRUNG_FLOOR', 'CHANGING_ROOM'],
    pricePerHour: 20_000,
    ratingAverage: 4.8,
    ratingCount: 74,
    areaSqm: 150,
    capacity: 25,
    latitude: 40.1836,
    longitude: 44.5152,
  },
  {
    slug: 'rhythm-space',
    name: 'Rhythm Space',
    description: 'Equipped hall with showers and full sound setup.',
    district: 'Arabkir',
    asset: 'studio-rhythm-space',
    amenities: ['MIRRORS', 'SOUND_SYSTEM', 'SHOWERS', 'LOCKERS', 'AIR_CONDITIONING'],
    pricePerHour: 25_000,
    ratingAverage: 4.9,
    ratingCount: 51,
    areaSqm: 180,
    capacity: 30,
    latitude: 40.2019,
    longitude: 44.5017,
  },
  {
    slug: 'flow-studio',
    name: 'Flow Studio',
    description: 'Daylight hall with wood floor and ballet barre.',
    district: 'Ajapnyak',
    asset: 'studio-flow-studio',
    amenities: ['WOOD_FLOOR', 'BARRE', 'NATURAL_LIGHT', 'MIRRORS'],
    pricePerHour: 15_000,
    ratingAverage: 4.7,
    ratingCount: 33,
    areaSqm: 120,
    capacity: 18,
    latitude: 40.1932,
    longitude: 44.4589,
  },
];

/* ─────────────────────────── Занятия ─────────────────────────── */

export interface DemoClass {
  slug: string;
  title: string;
  description: string;
  instructorSlug: string;
  venueSlug: string;
  style: DanceStyle;
  level: SkillLevel;
  durationMinutes: number;
  price: number;
  capacity: number;
  /** Свободные места на ближайшем занятии — из бейджей прототипа. */
  spotsLeft: number;
  learningPoints: readonly string[];
  isTrending: boolean;
  asset: string;
  coverAsset?: string;
  /** Расписание как оно подписано в макете. */
  scheduleLabel: string;
  weekday: number;
  startTime: string;
}

export const demoClasses: readonly DemoClass[] = [
  {
    slug: 'latin-fusion',
    title: 'Latin Fusion',
    description:
      'Dive into the vibrant world of Latin dance! This class blends salsa, bachata, and ' +
      'cha-cha into one electrifying session. Perfect for intermediate dancers looking to ' +
      'expand their Latin repertoire.',
    instructorSlug: 'anna-mkrtchyan',
    venueSlug: 'pulse-dance-studio',
    style: 'SALSA',
    level: 'INTERMEDIATE',
    durationMinutes: 90,
    price: 12_000,
    capacity: 20,
    spotsLeft: 8,
    learningPoints: ['Salsa Basics', 'Bachata Footwork', 'Partner Connection', 'Musicality'],
    isTrending: true,
    asset: 'style-salsa',
    coverAsset: 'class-latin-fusion-cover',
    scheduleLabel: 'Saturday, 18:00',
    weekday: 6,
    startTime: '18:00',
  },
  {
    slug: 'street-flow',
    title: 'Street Flow',
    description: 'Hip-hop foundations, grooves and short choreography for every level.',
    instructorSlug: 'arman-harutyunyan',
    venueSlug: 'pulse-dance-studio',
    style: 'HIP_HOP',
    level: 'ALL_LEVELS',
    durationMinutes: 60,
    price: 10_000,
    capacity: 22,
    spotsLeft: 12,
    learningPoints: ['Grooves', 'Isolations', 'Choreography', 'Freestyle Basics'],
    isTrending: false,
    asset: 'style-hip-hop',
    scheduleLabel: 'Sunday, 14:00',
    weekday: 0,
    startTime: '14:00',
  },
  {
    slug: 'classical-ballet-intensive',
    title: 'Classical Ballet Intensive',
    description: 'Barre, centre and repertoire for advanced students, three times a week.',
    instructorSlug: 'sona-hovhannisyan',
    venueSlug: 'flow-studio',
    style: 'BALLET',
    level: 'ADVANCED',
    durationMinutes: 120,
    price: 15_000,
    capacity: 14,
    /** В макете подписано FULL / Waitlist. */
    spotsLeft: 0,
    learningPoints: ['Barre Work', 'Centre Practice', 'Repertoire', 'Pointe'],
    isTrending: false,
    asset: 'style-ballet',
    scheduleLabel: 'Mon/Wed/Fri',
    weekday: 1,
    startTime: '19:00',
  },
  {
    slug: 'contemporary-flow',
    title: 'Contemporary Flow',
    description: 'Floor work, breath and continuous movement for intermediate dancers.',
    instructorSlug: 'nare-grigoryan',
    venueSlug: 'rhythm-space',
    style: 'CONTEMPORARY',
    level: 'INTERMEDIATE',
    durationMinutes: 90,
    price: 12_000,
    capacity: 16,
    spotsLeft: 5,
    learningPoints: ['Floor Work', 'Breath', 'Release Technique', 'Improvisation'],
    isTrending: false,
    asset: 'style-contemporary',
    scheduleLabel: 'Thu, 19:00',
    weekday: 4,
    startTime: '19:00',
  },
];

/** Слоты со страницы бронирования прототипа. */
export const demoAvailableSlots = ['10:00', '11:30', '14:00', '18:00', '19:30', '21:00'] as const;


/* ─────────────────────────── Товары ─────────────────────────── */

export interface DemoProduct {
  slug: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  price: number;
  asset: string;
  variants: ReadonlyArray<{
    sku: string;
    size?: string;
    color?: string;
    price: number;
    stock: number;
  }>;
  /** Подарочная карта продаётся «от суммы», а не по фиксированной цене. */
  isGiftCard?: true;
}

export const demoProducts: readonly DemoProduct[] = [
  {
    slug: 'premium-dance-bag',
    title: 'Premium Dance Bag',
    description: 'Structured duffel with separate shoe compartment and gold hardware.',
    brand: 'ArtDance',
    category: 'accessories',
    price: 18_000,
    asset: 'product-dance-bag',
    variants: [
      { sku: 'AD-BAG-BLK-M', size: 'Medium', color: 'Black', price: 18_000, stock: 24 },
      { sku: 'AD-BAG-BLK-L', size: 'Large', color: 'Black', price: 21_000, stock: 11 },
    ],
  },
  {
    slug: 'dance-shoes-collection',
    title: 'Dance Shoes Collection',
    description: 'Latin heels and ballet slippers with suede soles.',
    brand: 'ArtDance',
    category: 'shoes',
    price: 12_500,
    asset: 'product-dance-shoes',
    variants: [
      { sku: 'AD-SHOE-SH-37', size: '37', color: 'Salsa Heels', price: 12_500, stock: 6 },
      { sku: 'AD-SHOE-SH-38', size: '38', color: 'Salsa Heels', price: 12_500, stock: 9 },
      { sku: 'AD-SHOE-SH-39', size: '39', color: 'Salsa Heels', price: 12_500, stock: 3 },
    ],
  },
  {
    slug: 'training-apparel-set',
    title: 'Training Apparel Set',
    description: 'Leggings and fitted top for daily training.',
    brand: 'ArtDance',
    category: 'apparel',
    price: 15_000,
    asset: 'product-training-apparel',
    variants: [
      { sku: 'AD-APP-BRG-S', size: 'S', color: 'Burgundy', price: 15_000, stock: 14 },
      { sku: 'AD-APP-BRG-M', size: 'M', color: 'Burgundy', price: 15_000, stock: 18 },
      { sku: 'AD-APP-BLK-M', size: 'M', color: 'Black', price: 15_000, stock: 7 },
    ],
  },
  {
    slug: 'gift-card',
    title: 'Gift Card',
    description: 'Let them choose their own class, session or gear.',
    brand: 'ArtDance',
    category: 'gift-cards',
    price: 5_000,
    asset: 'product-gift-card',
    variants: [
      { sku: 'AD-GC-5000', price: 5_000, stock: 999 },
      { sku: 'AD-GC-10000', price: 10_000, stock: 999 },
      { sku: 'AD-GC-20000', price: 20_000, stock: 999 },
      { sku: 'AD-GC-50000', price: 50_000, stock: 999 },
    ],
    isGiftCard: true,
  },
];

export const demoProductCategories: ReadonlyArray<{ slug: string; name: string; order: number }> = [
  { slug: 'apparel', name: 'Apparel', order: 1 },
  { slug: 'shoes', name: 'Shoes', order: 2 },
  { slug: 'accessories', name: 'Accessories', order: 3 },
  { slug: 'gift-cards', name: 'Gift Cards', order: 4 },
];

/* ─────────────────────────── События ─────────────────────────── */

export interface DemoEvent {
  slug: string;
  title: string;
  description: string;
  type: EventType;
  /** ISO-дата без года: год подставляется сидом от текущей даты. */
  monthDay: string;
  startTime: string;
  endTime: string;
  venueSlug?: string;
  locationName?: string;
  price: number;
  capacity: number;
  spotsLeft: number;
  asset: string;
}

export const demoEvents: readonly DemoEvent[] = [
  {
    slug: 'bachata-night-workshop',
    title: 'Bachata Night Workshop',
    description: 'Two-hour bachata intensive with partner rotation.',
    type: 'WORKSHOP',
    monthDay: '09-15',
    startTime: '19:00',
    endTime: '21:00',
    venueSlug: 'pulse-dance-studio',
    price: 8_000,
    capacity: 30,
    spotsLeft: 15,
    asset: 'editorial-rhythm',
  },
  {
    slug: 'yerevan-street-battle',
    title: 'Yerevan Street Battle',
    description: 'Open-air hip-hop battle in the city centre.',
    type: 'BATTLE',
    monthDay: '09-22',
    startTime: '16:00',
    endTime: '22:00',
    locationName: 'Republic Square',
    /** В макете подписано Free / Open. */
    price: 0,
    capacity: 200,
    spotsLeft: 200,
    asset: 'style-hip-hop',
  },
  {
    slug: 'contemporary-masterclass',
    title: 'Contemporary Masterclass',
    description: 'Three-hour masterclass on release technique and improvisation.',
    type: 'MASTERCLASS',
    monthDay: '09-30',
    startTime: '14:00',
    endTime: '17:00',
    venueSlug: 'rhythm-space',
    price: 12_000,
    capacity: 24,
    spotsLeft: 8,
    asset: 'style-contemporary',
  },
];

/* ─────────────────────────── Отзывы ─────────────────────────── */

export interface DemoReview {
  authorName: string;
  authorRole: string;
  rating: number;
  body: string;
  asset: string;
  /** К чему относится отзыв: слаг занятия или инструктора. */
  targetType: 'class' | 'instructor';
  targetSlug: string;
}

export const demoReviews: readonly DemoReview[] = [
  {
    authorName: 'Mariam Ghazaryan',
    authorRole: 'Ballet · 2 years on ArtDance',
    rating: 5,
    body:
      'ArtDance completely transformed my dance journey. The instructors are world-class, ' +
      'and booking is seamless.',
    asset: 'instructor-anna-mkrtchyan',
    targetType: 'instructor',
    targetSlug: 'anna-mkrtchyan',
  },
  {
    authorName: 'Arman Harutyunyan',
    authorRole: 'Hip-Hop Instructor',
    rating: 5,
    body:
      'As an instructor, ArtDance gave me visibility I never had. My classes are always full now.',
    asset: 'product-dance-shoes',
    targetType: 'instructor',
    targetSlug: 'arman-harutyunyan',
  },
  {
    authorName: 'Narine Hovhannisyan',
    authorRole: 'Salsa · 6 months on ArtDance',
    rating: 5,
    body: "I was intimidated to try salsa, but the community is so welcoming. Now I'm hooked!",
    asset: 'studio-rhythm-space',
    targetType: 'class',
    targetSlug: 'latin-fusion',
  },
];

/* ─────────────────────────── Показатели главной ─────────────────────────── */

/**
 * Цифры из hero-блока прототипа. В продукте считаются из БД; здесь нужны, чтобы
 * демо-страница совпадала с макетом до появления реальных данных.
 */
export const demoHeroStats = {
  activeDancers: 2_500,
  expertInstructors: 150,
  danceStyles: 50,
  averageRating: 4.9,
} as const;

/**
 * Контрольный расчёт корзины из макета. Используется тестом:
 * если формула итогов изменится, расхождение с утверждённым дизайном
 * станет красным тестом, а не спором на приёмке.
 */
export const demoCartTotals = {
  items: [
    { productSlug: 'premium-dance-bag', variantSku: 'AD-BAG-BLK-M', quantity: 1, unitPrice: 18_000 },
    { productSlug: 'training-apparel-set', variantSku: 'AD-APP-BRG-S', quantity: 2, unitPrice: 15_000 },
    { productSlug: 'dance-shoes-collection', variantSku: 'AD-SHOE-SH-38', quantity: 1, unitPrice: 12_500 },
  ],
  subtotal: 60_500,
  deliveryFee: 0,
  promoCode: 'WELCOME10',
  discount: 6_050,
  total: 54_450,
} as const;
